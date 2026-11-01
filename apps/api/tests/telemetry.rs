use piko::{model::Event, telemetry::Telemetry};
use std::time::{Duration, Instant};
fn event() -> Event {
    Event {
        event_id: uuid::Uuid::new_v4().to_string(),
        name: "command_run".into(),
        source: "cli".into(),
        timestamp: None,
        actor_id: None,
        identity_kind: None,
        session_id: None,
        properties: serde_json::Map::new(),
    }
}
#[tokio::test]
async fn full_queue_is_nonblocking_and_shutdown_bounds_hung_delivery() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let peer = tokio::spawn(async move {
        let (_socket, _) = listener.accept().await.unwrap();
        tokio::time::sleep(Duration::from_secs(10)).await;
    });
    let client = Telemetry::new(
        format!("http://{address}"),
        "unused".into(),
        1,
        Duration::from_secs(5),
    )
    .unwrap();
    assert!(client.track(event()));
    assert!(!client.track(event()));
    let begin = Instant::now();
    assert!(!client.shutdown(Duration::from_millis(80)).await);
    assert!(begin.elapsed() < Duration::from_millis(400));
    peer.abort();
}

#[tokio::test]
async fn redirects_never_receive_the_event_body() {
    use axum::{Router, http::StatusCode, routing::post};
    use std::sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    };

    for status in [
        StatusCode::TEMPORARY_REDIRECT,
        StatusCode::PERMANENT_REDIRECT,
    ] {
        let forwarded = Arc::new(AtomicUsize::new(0));
        let count = forwarded.clone();
        let destination = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let destination_address = destination.local_addr().unwrap();
        let destination_task = tokio::spawn(async move {
            axum::serve(
                destination,
                Router::new().route(
                    "/receive",
                    post(move || async move {
                        count.fetch_add(1, Ordering::SeqCst);
                        StatusCode::OK
                    }),
                ),
            )
            .await
            .unwrap();
        });
        let source = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let source_address = source.local_addr().unwrap();
        let requests = Arc::new(AtomicUsize::new(0));
        let count = requests.clone();
        let source_task = tokio::spawn(async move {
            axum::serve(
                source,
                Router::new().route(
                    "/api/ingest",
                    post(move || async move {
                        count.fetch_add(1, Ordering::SeqCst);
                        (
                            status,
                            [("location", format!("http://{destination_address}/receive"))],
                        )
                    }),
                ),
            )
            .await
            .unwrap();
        });
        let client = Telemetry::new(
            format!("http://{source_address}"),
            "public-ingestion-key".into(),
            4,
            Duration::from_secs(1),
        )
        .unwrap();
        assert!(client.track(event()));
        assert!(client.shutdown(Duration::from_secs(2)).await);
        assert_eq!(requests.load(Ordering::SeqCst), 1);
        assert_eq!(forwarded.load(Ordering::SeqCst), 0);
        source_task.abort();
        destination_task.abort();
    }
}
