use anyhow::{Context, Result, ensure};
use reqwest::{Client, Url, redirect::Policy};
use serde::{Deserialize, Serialize};
use std::{collections::BTreeSet, time::Duration};
use tokio::{sync::broadcast, task::JoinHandle};

const CAPACITY: usize = 128;
const MAX_PRODUCTS: usize = 64;
const COALESCE: Duration = Duration::from_millis(250);
const REQUEST_TIMEOUT: Duration = Duration::from_millis(800);

#[derive(Clone)]
pub struct Changes {
    tx: broadcast::Sender<String>,
}
impl Default for Changes {
    fn default() -> Self {
        let (tx, _) = broadcast::channel(CAPACITY);
        Self { tx }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ChangeEnvelope {
    pub version: u8,
    pub products: Option<Vec<String>>,
}

pub struct ChangeDelivery {
    endpoint: Url,
    token: String,
}
impl ChangeDelivery {
    pub fn new(endpoint: &str, token: String) -> Result<Self> {
        let endpoint = Url::parse(endpoint).context("PIKO_CHANGE_URL must be an absolute URL")?;
        ensure!(
            matches!(endpoint.scheme(), "http" | "https")
                && endpoint.host_str().is_some()
                && endpoint.username().is_empty()
                && endpoint.password().is_none()
                && endpoint.query().is_none()
                && endpoint.fragment().is_none(),
            "PIKO_CHANGE_URL must be HTTP(S), without credentials, query, or fragment"
        );
        ensure!(
            !token.is_empty(),
            "PIKO_CHANGE_TOKEN is required with PIKO_CHANGE_URL"
        );
        Ok(Self { endpoint, token })
    }
}

impl Changes {
    pub fn subscribe(&self) -> broadcast::Receiver<String> {
        self.tx.subscribe()
    }

    pub(crate) fn product_changed(&self, product: &str) {
        let _ = self.tx.send(product.to_owned());
    }

    pub fn start_delivery(&self, config: ChangeDelivery) -> Result<JoinHandle<()>> {
        let client = Client::builder()
            .timeout(REQUEST_TIMEOUT)
            .redirect(Policy::none())
            .build()?;
        let receiver = self.subscribe();
        Ok(tokio::spawn(deliver(receiver, client, config)))
    }
}

// None means a full resync, including changes lost to queue lag or a failed delivery.
fn add_product(pending: &mut Option<BTreeSet<String>>, product: String) {
    if let Some(products) = pending {
        products.insert(product);
        if products.len() > MAX_PRODUCTS {
            *pending = None;
        }
    }
}

async fn deliver(
    mut receiver: broadcast::Receiver<String>,
    client: Client,
    config: ChangeDelivery,
) {
    let mut pending: Option<BTreeSet<String>> = None;
    let mut backoff = Duration::from_secs(1);
    loop {
        if pending.as_ref().is_some_and(BTreeSet::is_empty) {
            match receiver.recv().await {
                Ok(product) => add_product(&mut pending, product),
                Err(broadcast::error::RecvError::Lagged(_)) => pending = None,
                Err(broadcast::error::RecvError::Closed) => return,
            }
            tokio::time::sleep(COALESCE).await;
        }
        loop {
            match receiver.try_recv() {
                Ok(product) => add_product(&mut pending, product),
                Err(broadcast::error::TryRecvError::Lagged(_)) => pending = None,
                Err(broadcast::error::TryRecvError::Empty) => break,
                Err(broadcast::error::TryRecvError::Closed) => return,
            }
        }
        let envelope = ChangeEnvelope {
            version: 1,
            products: pending
                .as_ref()
                .map(|products| products.iter().cloned().collect()),
        };
        let sent = client
            .post(config.endpoint.clone())
            .bearer_auth(&config.token)
            .json(&envelope)
            .send()
            .await
            .is_ok_and(|response| response.status().is_success());
        if sent {
            pending = Some(BTreeSet::new());
            backoff = Duration::from_secs(1);
        } else {
            tracing::warn!(
                retry_seconds = backoff.as_secs(),
                "Change delivery failed; retrying a full refresh"
            );
            pending = None;
            tokio::time::sleep(backoff).await;
            backoff = (backoff * 2).min(Duration::from_secs(30));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        Json, Router,
        http::{HeaderMap, StatusCode},
        routing::post,
    };
    use std::sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    };

    #[test]
    fn product_sets_and_queue_overflow_are_bounded() {
        let mut pending = Some(BTreeSet::new());
        for _ in 0..1000 {
            add_product(&mut pending, uuid::Uuid::new_v4().to_string());
        }
        assert!(pending.is_none());
        let changes = Changes::default();
        let mut receiver = changes.subscribe();
        for _ in 0..1000 {
            changes.product_changed(&uuid::Uuid::new_v4().to_string());
        }
        assert!(matches!(
            receiver.try_recv(),
            Err(broadcast::error::TryRecvError::Lagged(_))
        ));
        let mut retained = 0;
        while receiver.try_recv().is_ok() {
            retained += 1;
        }
        assert!(retained <= CAPACITY);
    }

    #[tokio::test]
    async fn failed_delivery_retries_global_then_coalesces_product_hints() {
        let calls = Arc::new(AtomicUsize::new(0));
        let attempts = calls.clone();
        let (tx, mut rx) = tokio::sync::mpsc::channel(8);
        let app = Router::new().route(
            "/changes",
            post(
                move |headers: HeaderMap, Json(message): Json<ChangeEnvelope>| {
                    let tx = tx.clone();
                    let attempts = attempts.clone();
                    async move {
                        assert_eq!(headers["authorization"], "Bearer test-only-token");
                        tx.send(message).await.unwrap();
                        if attempts.fetch_add(1, Ordering::SeqCst) == 0 {
                            StatusCode::SERVICE_UNAVAILABLE
                        } else {
                            StatusCode::NO_CONTENT
                        }
                    }
                },
            ),
        );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        let changes = Changes::default();
        let delivery = changes
            .start_delivery(
                ChangeDelivery::new(
                    &format!("http://{address}/changes"),
                    "test-only-token".into(),
                )
                .unwrap(),
            )
            .unwrap();
        assert_eq!(rx.recv().await.unwrap().products, None);
        let a = uuid::Uuid::new_v4().to_string();
        changes.product_changed(&a);
        assert_eq!(
            tokio::time::timeout(Duration::from_secs(3), rx.recv())
                .await
                .unwrap()
                .unwrap()
                .products,
            None
        );
        // Let the successful response settle before checking the next coalesced batch.
        tokio::time::sleep(Duration::from_millis(30)).await;
        let b = uuid::Uuid::new_v4().to_string();
        changes.product_changed(&a);
        changes.product_changed(&a);
        changes.product_changed(&b);
        let result = tokio::time::timeout(Duration::from_secs(2), rx.recv())
            .await
            .unwrap()
            .unwrap();
        let mut expected = vec![a, b];
        expected.sort();
        assert_eq!(
            result,
            ChangeEnvelope {
                version: 1,
                products: Some(expected)
            }
        );
        delivery.abort();
        server.abort();
    }

    #[tokio::test]
    async fn hanging_delivery_has_a_short_deadline() {
        let attempts = Arc::new(AtomicUsize::new(0));
        let counter = attempts.clone();
        let app = Router::new().route(
            "/changes",
            post(move || {
                counter.fetch_add(1, Ordering::SeqCst);
                async { std::future::pending::<StatusCode>().await }
            }),
        );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        let changes = Changes::default();
        let delivery = changes
            .start_delivery(
                ChangeDelivery::new(
                    &format!("http://{address}/changes"),
                    "test-only-token".into(),
                )
                .unwrap(),
            )
            .unwrap();
        tokio::time::timeout(Duration::from_secs(3), async {
            while attempts.load(Ordering::SeqCst) < 2 {
                tokio::time::sleep(Duration::from_millis(20)).await;
            }
        })
        .await
        .expect("request must time out and retry without waiting for the server");
        delivery.abort();
        server.abort();
    }
}
