use crate::{Error, Options, Piko, Request, Response, Transport};
use std::time::Duration;

/// Certificate-verifying HTTPS using reqwest/rustls and the system trust store.
/// Requires an active Tokio runtime with its time and I/O drivers enabled.
#[derive(Clone)]
pub struct HttpsTransport(reqwest::Client);

impl HttpsTransport {
    pub fn new() -> Result<Self, Error> {
        reqwest::Client::builder()
            .use_rustls_tls()
            .redirect(reqwest::redirect::Policy::none())
            .referer(false)
            .build()
            .map(Self)
            .map_err(|error| Error::Transport(error.to_string()))
    }
}

impl Piko<HttpsTransport> {
    pub fn new(endpoint: impl Into<String>, key: impl Into<String>) -> Result<Self, Error> {
        Self::with_options(endpoint, key, Options::default())
    }

    pub fn with_options(
        endpoint: impl Into<String>,
        key: impl Into<String>,
        options: Options,
    ) -> Result<Self, Error> {
        Self::with_transport_options(endpoint, key, HttpsTransport::new()?, options)
    }
}

impl Transport for HttpsTransport {
    async fn post(&self, request: Request<'_>) -> Result<Response, Error> {
        let remaining = request.remaining();
        if remaining.is_zero() {
            return Err(Error::Timeout);
        }
        tokio::time::timeout(remaining, async {
            let mut response = self
                .0
                .post(request.url)
                .header(reqwest::header::CONTENT_TYPE, "application/json")
                .bearer_auth(request.key)
                .body(request.body.to_owned())
                .timeout(remaining)
                .send()
                .await
                .map_err(network_error)?;
            let status = response.status().as_u16();
            let retry_after = response
                .headers()
                .get(reqwest::header::RETRY_AFTER)
                .and_then(|header| header.to_str().ok())
                .and_then(|value| value.parse::<u64>().ok())
                .map(Duration::from_secs);
            let mut bytes = Vec::new();
            while let Some(chunk) = response.chunk().await.map_err(network_error)? {
                if bytes.len() + chunk.len() > 16 * 1024 {
                    return Err(Error::ResponseTooLarge);
                }
                bytes.extend_from_slice(&chunk);
            }
            Ok(Response {
                status,
                body: String::from_utf8_lossy(&bytes).into_owned(),
                retry_after,
            })
        })
        .await
        .map_err(|_| Error::Timeout)?
    }

    async fn sleep(&self, delay: Duration) {
        tokio::time::sleep(delay).await;
    }
}

fn network_error(error: reqwest::Error) -> Error {
    if error.is_timeout() {
        Error::Timeout
    } else {
        Error::Transport(error.to_string())
    }
}
