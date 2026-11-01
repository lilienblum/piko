use piko::{AppState, Config, router};
use std::{env, time::Duration};
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "piko=info".into()),
        )
        .init();
    let config = Config {
        data_dir: env::var("PIKO_DATA_DIR")
            .unwrap_or_else(|_| "data".into())
            .into(),
        admin_token: env::var("PIKO_ADMIN_TOKEN").map_err(|_| {
            anyhow::anyhow!("Set PIKO_ADMIN_TOKEN to a random secret of at least 16 characters")
        })?,
        query_concurrency: env::var("PIKO_QUERY_CONCURRENCY")
            .unwrap_or_else(|_| "4".into())
            .parse()?,
        queue_capacity: env::var("PIKO_QUEUE_CAPACITY")
            .unwrap_or_else(|_| "64".into())
            .parse()?,
        secure_cookie: env::var("PIKO_SECURE_COOKIE").as_deref() == Ok("true"),
    };
    let state = AppState::open(&config)?;
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
    let address = env::var("PIKO_BIND").unwrap_or_else(|_| "127.0.0.1:3001".into());
    let listener = tokio::net::TcpListener::bind(&address).await?;
    tracing::info!(%address,"Piko is ready");
    axum::serve(listener, router(state.clone()))
        .with_graceful_shutdown(shutdown())
        .await?;
    cleanup.abort();
    state.writer.stop().await;
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
