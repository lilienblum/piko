use piko::{model::Event, telemetry::Telemetry};
use serde_json::json;
use std::{
    collections::BTreeMap,
    time::{Duration, Instant},
};
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let command = std::env::args().nth(1).unwrap_or_else(|| "build".into());
    let start = Instant::now();
    // Your actual command runs here, independently of telemetry configuration.
    tokio::time::sleep(Duration::from_millis(75)).await;
    let success = command != "fail";
    println!("{command}: {}", if success { "complete" } else { "failed" });
    if std::env::var("PIKO_TELEMETRY").as_deref() == Ok("1")
        && std::env::var("DO_NOT_TRACK").as_deref() != Ok("1")
        && let (Ok(endpoint), Ok(key)) = (
            std::env::var("PIKO_ENDPOINT"),
            std::env::var("PIKO_INGESTION_KEY"),
        )
        && !endpoint.trim().is_empty()
        && !key.trim().is_empty()
    {
        let deadline = Duration::from_millis(
            std::env::var("PIKO_TELEMETRY_TIMEOUT_MS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(800)
                .clamp(1, 5000),
        );
        if let Ok(telemetry) = Telemetry::new(endpoint, key, 32, deadline) {
            let actor = std::env::var("PIKO_INSTALLATION_ID")
                .ok()
                .filter(|id| !id.is_empty());
            let command_name = match command.as_str() {
                "build" | "fail" | "check" | "init" | "dev" | "deploy" => command.as_str(),
                _ => "other",
            };
            let properties = BTreeMap::from([
                ("command", json!(command_name)),
                ("version", json!(env!("CARGO_PKG_VERSION"))),
                ("os", json!(std::env::consts::OS)),
                ("arch", json!(std::env::consts::ARCH)),
                ("success", json!(success)),
                ("duration_ms", json!(start.elapsed().as_millis() as u64)),
            ]);
            telemetry.track(Event {
                event_id: uuid::Uuid::new_v4().to_string(),
                name: "command_run".into(),
                source: "cli".into(),
                timestamp: Some(chrono::Utc::now()),
                identity_kind: actor.as_ref().map(|_| "installation".into()),
                actor_id: actor,
                session_id: None,
                properties: properties
                    .into_iter()
                    .map(|(k, v)| (k.to_string(), v))
                    .collect(),
            });
            telemetry
                .shutdown(deadline + Duration::from_millis(100))
                .await;
        }
    }
    if !success {
        std::process::exit(1);
    }
    Ok(())
}
