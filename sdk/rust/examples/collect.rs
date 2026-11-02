//! A standalone SDK integration. Run with explicit telemetry opt-in and a source key.
use piko_sdk::{Event, Piko};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    if std::env::var("PIKO_TELEMETRY").as_deref() != Ok("1")
        || std::env::var("DO_NOT_TRACK").as_deref() == Ok("1")
    {
        return Ok(());
    }
    let client = Piko::new(
        std::env::var("PIKO_ENDPOINT")?,
        std::env::var("PIKO_INGESTION_KEY")?,
    )?;
    let event = Event::new("command_run", "cli")
        .property("command", "build")
        .property("version", env!("CARGO_PKG_VERSION"))
        .property("success", true)
        .property("duration_ms", 42_u64);
    // Analytics is best effort for the application; a failed send never fails its work.
    if let Ok(ack) = client.send(&event).await {
        println!("Accepted: {}, duplicates: {}", ack.accepted, ack.duplicates);
    }
    Ok(())
}
