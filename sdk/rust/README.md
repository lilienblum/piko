# Piko Rust SDK

`piko-sdk` is a standalone ingestion SDK for Rust applications and CLIs. It has no dependency on the Piko API server, DuckDB, or SQLite. It uses established crates: **reqwest with rustls**, **Tokio**, **serde/serde_json**, **uuid**, and **chrono**. HTTPS certificate verification uses the system trust store; redirects are refused.

## Install from this checkout

The crate is not published to a registry yet. Use Rust 1.89+ (tested with 1.95), add a path dependency, and use an async Tokio runtime:

```toml
[dependencies]
piko-sdk = { path = "../piko/sdk/rust" }
tokio = { version = "1", features = ["macros", "rt-multi-thread", "time", "net"] }
```

## Send events

```rust
use piko_sdk::{Event, Piko};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let piko = Piko::new("https://piko.example.com", "pk_YOUR_SOURCE_KEY")?;
    let event = Event::new("command_run", "cli")
        .property("command", "build")
        .property("success", true)
        .property("duration_ms", 42_u64);

    let ack = piko.send(&event).await?;
    println!("Accepted: {}, duplicates: {}", ack.accepted, ack.duplicates);
    Ok(())
}
```

Your application owns collection preferences and error handling. Send only after opt-in when appropriate, honor `DO_NOT_TRACK`, and catch errors if analytics must not fail the main operation. The SDK creates no identity, storage, background worker, or persistent queue. The example above propagates errors to make delivery visible.

`endpoint` is the collector base URL; `/api/ingest` is appended. Use HTTPS in production and a separate unrestricted source key for server/CLI collectors. A key selects the project and source. The event's `source` string only labels its client/transport.

`Event::new` captures a UUID and UTC timestamp once. Reuse the same event, or persist its `event_id` and `timestamp`, for application-level retries. Identity is absent by default. To use it, set both `actor_id` and `identity_kind`; `session_id` is only valid for `IdentityKind::Visitor`. Properties support strings, booleans, finite `f64` values, and signed/unsigned 64-bit integers. Use integer suffixes such as `42_u64` or `42_i64` with `.property()`.

`send_batch(&events)` accepts 1–100 events within 256 KiB of JSON. Validation occurs before network work. An `Ack` confirms the API committed the request; duplicates count IDs already stored in that project. A timeout can occur after commit, so retry with the original IDs.

## Delivery controls

```rust
use piko_sdk::{Options, Piko};
use std::time::Duration;

let piko = Piko::with_options(
    "https://piko.example.com",
    "pk_YOUR_SOURCE_KEY",
    Options { timeout: Duration::from_secs(2), retries: 1 },
)?;
```

The default total deadline is 800 ms with one retry. It covers requests, response reads, and backoff. Only network failures, 429, and 5xx retry. Numeric `Retry-After` is respected; a delay beyond the remaining budget ends delivery. The exact JSON is reused. Responses are limited to 16 KiB. Dropping the send future cancels its I/O; there is no worker to shut down. The built-in transport requires an active Tokio runtime with time and I/O enabled.

`Error` distinguishes configuration/validation errors, HTTP status errors, network failures, invalid acknowledgments, oversized responses, and deadlines. Keys and event bodies are not included in the client's debug output. Never log transport requests or private properties.

To reuse an application's HTTP stack, implement `Transport` and call `Piko::with_transport` or `Piko::with_transport_options`. Follow its documented deadline, certificate verification, redirect, and credential contract. The built-in transport is the recommended default.

From the repository root, a runnable opt-in example is available:

```sh
PIKO_TELEMETRY=1 PIKO_ENDPOINT=http://127.0.0.1:3001 \
PIKO_INGESTION_KEY=pk_YOUR_KEY cargo run -p piko-sdk --example collect
```

Build and test the standalone crate with `cargo test -p piko-sdk`. Run `cargo package -p piko-sdk` to create a local crate archive; this does not publish it.
