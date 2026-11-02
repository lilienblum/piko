use crate::Error;
use chrono::{DateTime, Utc};
use serde::Serialize;
use std::collections::BTreeMap;

/// Flat scalar properties; nested objects and null are intentionally unsupported.
pub type Properties = BTreeMap<String, Value>;

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(untagged)]
pub enum Value {
    String(String),
    Number(f64),
    Integer(i64),
    Unsigned(u64),
    Bool(bool),
}
impl From<String> for Value {
    fn from(value: String) -> Self {
        Self::String(value)
    }
}
impl From<&str> for Value {
    fn from(value: &str) -> Self {
        Self::String(value.into())
    }
}
impl From<f64> for Value {
    fn from(value: f64) -> Self {
        Self::Number(value)
    }
}
impl From<i64> for Value {
    fn from(value: i64) -> Self {
        Self::Integer(value)
    }
}
impl From<u64> for Value {
    fn from(value: u64) -> Self {
        Self::Unsigned(value)
    }
}
impl From<bool> for Value {
    fn from(value: bool) -> Self {
        Self::Bool(value)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum IdentityKind {
    Visitor,
    Installation,
    Actor,
}

#[derive(Clone, Debug, Serialize)]
pub struct Event {
    /// Unique across every source in a project. Generated once; reuse on retries.
    pub event_id: String,
    pub name: String,
    /// Client/transport label; the ingestion key determines project/source attribution.
    pub source: String,
    pub timestamp: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actor_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identity_kind: Option<IdentityKind>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    pub properties: Properties,
}

impl Event {
    /// Captures a random UUID and timestamp once; identity is absent by default.
    /// Set `event_id` explicitly when retrying a persisted application record.
    pub fn new(name: impl Into<String>, source: impl Into<String>) -> Self {
        Self {
            event_id: uuid::Uuid::new_v4().to_string(),
            name: name.into(),
            source: source.into(),
            timestamp: Utc::now(),
            actor_id: None,
            identity_kind: None,
            session_id: None,
            properties: Properties::new(),
        }
    }

    pub fn property(mut self, key: impl Into<String>, value: impl Into<Value>) -> Self {
        self.properties.insert(key.into(), value.into());
        self
    }

    fn validate(&self) -> Result<(), Error> {
        if !valid_key(&self.event_id) || !valid_key(&self.name) || !valid_key(&self.source) {
            return Err(Error::InvalidEvent(
                "event_id, name and source require 1–64 ASCII letters, digits, _, -, . or /",
            ));
        }
        if self
            .actor_id
            .iter()
            .chain(self.session_id.iter())
            .any(|s| s.is_empty() || s.len() > 128)
        {
            return Err(Error::InvalidEvent(
                "actor_id and session_id require 1–128 bytes",
            ));
        }
        if self.actor_id.is_some() != self.identity_kind.is_some()
            || (self.session_id.is_some() && self.identity_kind != Some(IdentityKind::Visitor))
        {
            return Err(Error::InvalidEvent(
                "actor_id requires identity_kind; session_id requires a visitor identity",
            ));
        }
        if self.properties.len() > 32 {
            return Err(Error::InvalidEvent("Maximum 32 properties"));
        }
        for (key, value) in &self.properties {
            if !valid_key(key)
                || matches!(value, Value::String(s) if s.len() > 2048)
                || matches!(value, Value::Number(n) if !n.is_finite())
            {
                return Err(Error::InvalidEvent(
                    "Properties require valid keys and finite numbers, strings (at most 2048 bytes), or booleans",
                ));
            }
        }
        Ok(())
    }
}

fn valid_key(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 64
        && value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"_-./".contains(&b))
}

pub(crate) fn encode_batch(events: &[Event]) -> Result<String, Error> {
    if events.is_empty() || events.len() > 100 {
        return Err(Error::InvalidEvent("Send 1–100 events"));
    }
    for event in events {
        event.validate()?;
    }
    #[derive(Serialize)]
    struct Batch<'a> {
        events: &'a [Event],
    }
    let out = serde_json::to_string(&Batch { events })
        .map_err(|_| Error::InvalidEvent("Cannot serialize events"))?;
    if out.len() > 256 * 1024 {
        return Err(Error::InvalidEvent(
            "Batch exceeds the API's 256 KiB body limit",
        ));
    }
    Ok(out)
}
