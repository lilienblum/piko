use axum::{
    Router,
    http::{HeaderMap, StatusCode},
    routing::post,
};
use piko::{AppState, Config, router};
use piko_sdk::{Ack, Error, Event, Options, Piko};
use serde_json::json;
use std::{
    sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    },
    time::{Duration, Instant},
};

async fn serve(app: Router) -> (String, tokio::task::JoinHandle<()>) {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let endpoint = format!("http://{}", listener.local_addr().unwrap());
    let task = tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });
    (endpoint, task)
}

#[tokio::test]
async fn sdk_events_commit_deduplicate_and_keep_typed_properties() {
    let dir = tempfile::tempdir().unwrap();
    let state = AppState::open(&Config {
        data_dir: dir.path().into(),
        query_concurrency: 1,
        queue_capacity: 8,
    })
    .unwrap();
    let (endpoint, task) = serve(router(state.clone())).await;
    let admin = reqwest::Client::new();
    let product: serde_json::Value = admin
        .post(format!("{endpoint}/api/products"))
        .header("X-Piko-Admin", "1")
        .json(&json!({"name":"SDK integration", "retention_days":30}))
        .send()
        .await
        .unwrap()
        .error_for_status()
        .unwrap()
        .json()
        .await
        .unwrap();
    let product_id = product["id"].as_str().unwrap();
    let key: serde_json::Value = admin
        .post(format!("{endpoint}/api/products/{product_id}/keys"))
        .header("X-Piko-Admin", "1")
        .json(&json!({"label":"SDK"}))
        .send()
        .await
        .unwrap()
        .error_for_status()
        .unwrap()
        .json()
        .await
        .unwrap();
    let client = Piko::with_options(
        &endpoint,
        key["key"].as_str().unwrap(),
        Options {
            timeout: Duration::from_secs(10),
            retries: 1,
        },
    )
    .unwrap();
    let events = [
        Event::new("command_run", "cli")
            .property("success", true)
            .property("duration_ms", 42_u64)
            .property("label", "quoted \"東京\"\n"),
        Event::new("configured", "server").property("enabled", false),
    ];
    assert_eq!(
        client.send_batch(&events).await.unwrap(),
        Ack {
            accepted: 2,
            duplicates: 0
        }
    );
    assert_eq!(
        client.send_batch(&events).await.unwrap(),
        Ack {
            accepted: 0,
            duplicates: 2
        }
    );
    let query: serde_json::Value = admin.post(format!("{endpoint}/api/products/{product_id}/query"))
        .header("X-Piko-Admin", "1").json(&json!({"from":(chrono::Utc::now()-chrono::Duration::minutes(1)).to_rfc3339(),"to":(chrono::Utc::now()+chrono::Duration::minutes(1)).to_rfc3339()}))
        .send().await.unwrap().error_for_status().unwrap().json().await.unwrap();
    assert_eq!(query["summary"]["total"], 2);
    let event = query["events"]
        .as_array()
        .unwrap()
        .iter()
        .find(|e| e["name"] == "command_run")
        .unwrap();
    assert_eq!(event["properties"]["duration_ms"], 42);
    assert_eq!(event["properties"]["success"], true);
    assert_eq!(event["properties"]["label"], "quoted \"東京\"\n");
    assert!(event["actor_id"].is_null());
    task.abort();
    state.writer.stop().await;
}

#[tokio::test]
async fn sdk_transport_refuses_redirects_and_omits_browser_credentials() {
    let forwarded = Arc::new(AtomicUsize::new(0));
    let count = forwarded.clone();
    let (destination, destination_task) = serve(Router::new().route(
        "/receive",
        post(move || async move {
            count.fetch_add(1, Ordering::SeqCst);
            "unexpected"
        }),
    ))
    .await;
    let (endpoint, task) = serve(Router::new().route(
        "/api/ingest",
        post(move |headers: HeaderMap| async move {
            assert_eq!(headers["authorization"], "Bearer pk_test");
            assert_eq!(headers["content-type"], "application/json");
            assert!(!headers.contains_key("cookie"));
            assert!(!headers.contains_key("referer"));
            (
                StatusCode::TEMPORARY_REDIRECT,
                [("location", format!("{destination}/receive"))],
            )
        }),
    ))
    .await;
    let client = Piko::new(endpoint, "pk_test").unwrap();
    assert!(matches!(
        client.send(&Event::new("test", "sdk")).await,
        Err(Error::Http { status: 307, .. })
    ));
    assert_eq!(forwarded.load(Ordering::SeqCst), 0);
    task.abort();
    destination_task.abort();
}

#[tokio::test]
async fn sdk_transport_bounds_hung_response_and_response_size() {
    let (endpoint, task) = serve(Router::new().route(
        "/api/ingest",
        post(|| async {
            tokio::time::sleep(Duration::from_secs(10)).await;
            "{}"
        }),
    ))
    .await;
    let client = Piko::with_options(
        endpoint,
        "pk_test",
        Options {
            timeout: Duration::from_millis(80),
            retries: 1,
        },
    )
    .unwrap();
    let start = Instant::now();
    assert!(matches!(
        client.send(&Event::new("test", "sdk")).await,
        Err(Error::Timeout)
    ));
    assert!(start.elapsed() < Duration::from_secs(1));
    task.abort();
    let (endpoint, task) =
        serve(Router::new().route("/api/ingest", post(|| async { "x".repeat(20_000) }))).await;
    let client = Piko::new(endpoint, "pk_test").unwrap();
    assert!(matches!(
        client.send(&Event::new("test", "sdk")).await,
        Err(Error::ResponseTooLarge)
    ));
    task.abort();
}
