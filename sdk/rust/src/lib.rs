//! Event collection for Piko with secure HTTPS by default.
//!
//! Uses reqwest/rustls on your Tokio runtime, with serde_json, UUIDs and chrono
//! for the wire format. Creates no background tasks or identity storage. Applications
//! with an existing HTTP stack can supply their own [`Transport`].
//!
//! ```no_run
//! use piko_sdk::{Event, Piko};
//!
//! # async fn collect() -> Result<(), piko_sdk::Error> {
//! let client = Piko::new("https://piko.example.com", "pk_YOUR_SOURCE_KEY")?;
//! let event = Event::new("command_run", "cli")
//!     .property("success", true)
//!     .property("duration_ms", 42_u64);
//! let ack = client.send(&event).await?;
//! # Ok(())
//! # }
//! ```

mod event;
pub use event::{Event, IdentityKind, Properties, Value};
mod https;
pub use https::HttpsTransport;

use std::{
    fmt,
    future::Future,
    time::{Duration, Instant},
};

/// Counts acknowledged by Piko after commit, including previously stored IDs.
#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Deserialize)]
pub struct Ack {
    pub accepted: usize,
    pub duplicates: usize,
}

#[derive(Debug)]
pub enum Error {
    InvalidOptions(&'static str),
    InvalidEvent(&'static str),
    Transport(String),
    Http { status: u16, body: String },
    InvalidAck,
    ResponseTooLarge,
    Timeout,
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidOptions(message) | Self::InvalidEvent(message) => f.write_str(message),
            Self::Transport(message) => write!(f, "Piko transport: {message}"),
            Self::Http { status, body } => write!(f, "Piko HTTP {status}: {body}"),
            Self::InvalidAck => f.write_str("Invalid ingestion acknowledgment"),
            Self::ResponseTooLarge => f.write_str("Piko response exceeds 16 KiB"),
            Self::Timeout => f.write_str("Piko delivery deadline reached"),
        }
    }
}
impl std::error::Error for Error {}

/// One attempt. Do not log this value: it contains an ingestion key and event data.
pub struct Request<'a> {
    pub url: &'a str,
    pub key: &'a str,
    pub body: &'a str,
    pub deadline: Instant,
}

impl Request<'_> {
    pub fn remaining(&self) -> Duration {
        self.deadline.saturating_duration_since(Instant::now())
    }
}

/// A fully read HTTP response. Bound response sizes in your transport.
pub struct Response {
    pub status: u16,
    pub body: String,
    /// Parsed Retry-After delay, if present. The SDK never retries earlier than this.
    pub retry_after: Option<Duration>,
}

/// Adapter to an application's HTTP stack and async runtime.
///
/// `post` MUST send JSON with `Authorization: Bearer <key>`, refuse redirects,
/// verify HTTPS certificates, omit cookies/referrer, and enforce `deadline` over
/// both sending and reading the response. It must not retry internally. Return
/// `Error::Transport` for retryable network failures and `Error::Timeout` when
/// the deadline expires. Dropping the future should cancel pending I/O.
///
/// Rust's standard library has no HTTP/TLS client or async timer; this contract
/// lets applications reuse theirs without adding a second connection pool.
pub trait Transport {
    fn post(&self, request: Request<'_>) -> impl Future<Output = Result<Response, Error>> + Send;
    fn sleep(&self, delay: Duration) -> impl Future<Output = ()> + Send;
}

#[derive(Clone, Copy, Debug)]
pub struct Options {
    /// Total delivery budget, including all attempts and backoff.
    pub timeout: Duration,
    /// Additional attempts after the initial request.
    pub retries: u32,
}
impl Default for Options {
    fn default() -> Self {
        Self {
            timeout: Duration::from_millis(800),
            retries: 1,
        }
    }
}

/// Reusable ingestion client. Sends are explicit and await a durable acknowledgment.
/// The application owns consent and whether analytics errors affect its operation.
#[derive(Clone)]
pub struct Piko<T = HttpsTransport> {
    url: String,
    key: String,
    transport: T,
    options: Options,
}

impl<T: Transport> Piko<T> {
    pub fn with_transport(
        endpoint: impl Into<String>,
        key: impl Into<String>,
        transport: T,
    ) -> Result<Self, Error> {
        Self::with_transport_options(endpoint, key, transport, Options::default())
    }

    pub fn with_transport_options(
        endpoint: impl Into<String>,
        key: impl Into<String>,
        transport: T,
        options: Options,
    ) -> Result<Self, Error> {
        let endpoint = endpoint.into();
        let key = key.into();
        let invalid_endpoint = || {
            Error::InvalidOptions(
                "endpoint must be an HTTP(S) URL without credentials, query, or fragment",
            )
        };
        if endpoint
            .chars()
            .any(|c| c.is_whitespace() || c.is_control() || c == '\\')
        {
            return Err(invalid_endpoint());
        }
        let endpoint = reqwest::Url::parse(&endpoint).map_err(|_| invalid_endpoint())?;
        if !matches!(endpoint.scheme(), "https" | "http")
            || endpoint.host_str().is_none()
            || !endpoint.username().is_empty()
            || endpoint.password().is_some()
            || endpoint.query().is_some()
            || endpoint.fragment().is_some()
        {
            return Err(Error::InvalidOptions(
                "endpoint must be an HTTP(S) URL without credentials, query, or fragment",
            ));
        }
        if key.trim().is_empty() || key.contains(['\r', '\n']) {
            return Err(Error::InvalidOptions(
                "key is required and must not contain line breaks",
            ));
        }
        if options.timeout.is_zero() || Instant::now().checked_add(options.timeout).is_none() {
            return Err(Error::InvalidOptions(
                "timeout must be positive and representable",
            ));
        }
        Ok(Self {
            url: format!("{}/api/ingest", endpoint.as_str().trim_end_matches('/')),
            key,
            transport,
            options,
        })
    }

    pub async fn send(&self, event: &Event) -> Result<Ack, Error> {
        self.send_batch(std::slice::from_ref(event)).await
    }

    /// Sends 1–100 events. The exact JSON is reused on every retry.
    pub async fn send_batch(&self, events: &[Event]) -> Result<Ack, Error> {
        let body = event::encode_batch(events)?;
        let deadline = Instant::now()
            .checked_add(self.options.timeout)
            .ok_or(Error::Timeout)?;
        for attempt in 0..=self.options.retries {
            if Instant::now() >= deadline {
                return Err(Error::Timeout);
            }
            let result = self
                .transport
                .post(Request {
                    url: &self.url,
                    key: &self.key,
                    body: &body,
                    deadline,
                })
                .await;
            if Instant::now() >= deadline {
                return Err(Error::Timeout);
            }
            let mut delay = Duration::from_millis(50_u64.saturating_mul(1_u64 << attempt.min(20)));
            let error = match result {
                Ok(response) if (200..300).contains(&response.status) => {
                    let ack = parse_ack(&response.body).ok_or(Error::InvalidAck)?;
                    if ack.accepted.checked_add(ack.duplicates) != Some(events.len()) {
                        return Err(Error::InvalidAck);
                    }
                    return Ok(ack);
                }
                Ok(response) => {
                    let retryable = response.status == 429 || (500..600).contains(&response.status);
                    delay = delay.max(response.retry_after.unwrap_or_default());
                    let error = Error::Http {
                        status: response.status,
                        body: response.body,
                    };
                    if !retryable {
                        return Err(error);
                    }
                    error
                }
                Err(error @ Error::Transport(_)) => error,
                Err(error) => return Err(error),
            };
            if attempt == self.options.retries
                || delay >= deadline.saturating_duration_since(Instant::now())
            {
                return Err(error);
            }
            self.transport.sleep(delay).await;
        }
        unreachable!("at least one attempt")
    }
}

fn parse_ack(body: &str) -> Option<Ack> {
    serde_json::from_str(body).ok()
}

#[cfg(test)]
mod tests;
