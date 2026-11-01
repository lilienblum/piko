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
