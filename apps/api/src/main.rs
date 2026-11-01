use piko::{AppState, Config, changes::ChangeDelivery, router, runtime::lock_data_directory};
use std::{env, time::Duration};
fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "piko=info".into()),
        )
        .init();
    let managed = ["TAKO_DATA_DIR", "TAKO_BUILD", "TAKO_BOOTSTRAP_DATA"]
        .iter()
        .any(|name| env::var_os(name).is_some());
    // Bootstrap owns fd 3 in Tako. Read it before Tokio can allocate its own I/O
    // descriptor there, and never inspect inherited descriptors in standalone mode.
    if managed {
        tako::bootstrap()?;
    }
    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()?
        .block_on(run(managed))
}
async fn run(managed: bool) -> anyhow::Result<()> {
    let delivery_config = env::var("PIKO_CHANGE_URL")
        .ok()
        .map(|url| {
            let token = if managed {
                tako::secret("PIKO_CHANGE_TOKEN")
            } else {
                env::var("PIKO_CHANGE_TOKEN").ok()
            }
            .unwrap_or_default();
            ChangeDelivery::new(&url, token)
        })
        .transpose()?;
    let config = Config {
        data_dir: env::var("PIKO_DATA_DIR")
            .or_else(|_| env::var("TAKO_DATA_DIR"))
            .unwrap_or_else(|_| "data".into())
            .into(),
        query_concurrency: env::var("PIKO_QUERY_CONCURRENCY")
            .unwrap_or_else(|_| "4".into())
            .parse()?,
        queue_capacity: env::var("PIKO_QUEUE_CAPACITY")
            .unwrap_or_else(|_| "64".into())
            .parse()?,
    };
    let _data_lock = lock_data_directory(&config.data_dir)?;
    let state = AppState::open(&config)?;
    let notifications = delivery_config
        .map(|config| state.changes.start_delivery(config))
        .transpose()?;
    let cleanup_writer = state.writer.clone();
    let cleanup = tokio::spawn(async move {
        let mut timer = tokio::time::interval(Duration::from_secs(3600));
        loop {
            timer.tick().await;
            if let Err(e) = cleanup_writer.cleanup().await {
                tracing::warn!(error=?e,"Retention cleanup failed; will retry next hour");
            }
        }
    });
    let listener = if managed {
        tako::listener().await?
    } else {
        let address = env::var("PIKO_BIND").unwrap_or_else(|_| "127.0.0.1:3001".into());
        tokio::net::TcpListener::bind(&address).await?
    };
    tracing::info!(address=%listener.local_addr()?, managed, "Piko is ready");
    let app = router(state.clone());
    let app = if managed {
        tako::axum::router(app)
    } else {
        app
    };
    let result = axum::serve(listener, app)
        .with_graceful_shutdown(shutdown())
        .await;
    cleanup.abort();
    state.writer.stop().await;
    if let Some(notifications) = notifications {
        notifications.abort();
    }
    result?;
    Ok(())
}
async fn shutdown() {
    #[cfg(unix)]
    {
        let mut term = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("install SIGTERM handler");
        tokio::select! {_=tokio::signal::ctrl_c()=>{},_=term.recv()=>{}}
    }
    #[cfg(not(unix))]
    {
        let _ = tokio::signal::ctrl_c().await;
    }
}
