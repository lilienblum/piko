//! Best-effort bounded CLI delivery. Call `shutdown` with a short total deadline.
use crate::model::Event;
use serde_json::json;
use std::time::Duration;
use tokio::sync::{mpsc, oneshot};
enum Message {
    Event(Event),
    Flush(oneshot::Sender<()>),
    Stop(oneshot::Sender<()>),
}
pub struct Telemetry {
    tx: mpsc::Sender<Message>,
    task: tokio::task::JoinHandle<()>,
}
impl Telemetry {
    pub fn new(
        endpoint: String,
        key: String,
        capacity: usize,
        request_deadline: Duration,
    ) -> anyhow::Result<Self> {
        anyhow::ensure!(
            capacity > 0 && !request_deadline.is_zero(),
            "capacity and deadline must be positive"
        );
        let client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .timeout(request_deadline)
            .build()?;
        let (tx, mut rx) = mpsc::channel(capacity);
        let task = tokio::spawn(async move {
            let mut pending = Vec::new();
            let mut timer = tokio::time::interval(Duration::from_millis(100));
            loop {
                let control = tokio::select! {
                    item=rx.recv()=>match item{Some(Message::Event(e))=>{pending.push(e);None},other=>Some(other)},
                    _=timer.tick()=>Some(None),
                };
                if pending.len() >= 50 || control.is_some() {
                    if !pending.is_empty() {
                        let batch = std::mem::take(&mut pending);
                        // Reuse IDs for the one bounded retry. Errors never escape into the CLI command.
                        for attempt in 0..2 {
                            let result = client
                                .post(format!("{}/api/ingest", endpoint.trim_end_matches('/')))
                                .bearer_auth(&key)
                                .json(&json!({"events":batch}))
                                .send()
                                .await;
                            let mut delay = Duration::from_millis(40);
                            match result {
                                Ok(r) if r.status().is_success() => break,
                                Ok(r)
                                    if !r.status().is_server_error()
                                        && r.status().as_u16() != 429 =>
                                {
                                    break;
                                }
                                Ok(r) => {
                                    if let Some(seconds) = r
                                        .headers()
                                        .get("retry-after")
                                        .and_then(|v| v.to_str().ok())
                                        .and_then(|v| v.parse::<u64>().ok())
                                    {
                                        delay = Duration::from_secs(seconds).max(delay);
                                        if delay > request_deadline {
                                            break;
                                        }
                                    }
                                }
                                Err(_) => {}
                            }
                            if attempt == 0 {
                                tokio::time::sleep(delay).await;
                            }
                        }
                    }
                    match control {
                        Some(Some(Message::Flush(ack))) => {
                            let _ = ack.send(());
                        }
                        Some(Some(Message::Stop(ack))) => {
                            let _ = ack.send(());
                            break;
                        }
                        Some(None) if rx.is_closed() => break,
                        _ => {}
                    }
                }
            }
        });
        Ok(Self { tx, task })
    }
    /// Returns false immediately when the queue is full. Never blocks the command.
    pub fn track(&self, event: Event) -> bool {
        self.tx.try_send(Message::Event(event)).is_ok()
    }
    /// True means all prior events were attempted, not guaranteed delivered.
    pub async fn flush(&self, deadline: Duration) -> bool {
        let (ack, rx) = oneshot::channel();
        tokio::time::timeout(deadline, async {
            self.tx.send(Message::Flush(ack)).await.ok()?;
            rx.await.ok()
        })
        .await
        .is_ok_and(|r| r.is_some())
    }
    /// Stops the worker by the deadline, canceling unfinished network requests.
    pub async fn shutdown(self, deadline: Duration) -> bool {
        let (ack, rx) = oneshot::channel();
        let done = tokio::time::timeout(deadline, async {
            self.tx.send(Message::Stop(ack)).await.ok()?;
            rx.await.ok()
        })
        .await
        .is_ok_and(|r| r.is_some());
        self.task.abort();
        done
    }
}
impl Drop for Telemetry {
    fn drop(&mut self) {
        self.task.abort();
    }
}
