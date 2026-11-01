use crate::error::{ApiError, ApiResult};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Event {
    pub event_id: String,
    pub name: String,
    pub source: String,
    pub timestamp: Option<DateTime<Utc>>,
    pub actor_id: Option<String>,
    pub identity_kind: Option<String>,
    pub session_id: Option<String>,
    #[serde(default)]
    pub properties: Map<String, Value>,
}
#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum IngestPayload {
    Single(Event),
    Batch { events: Vec<Event> },
}
impl IngestPayload {
    pub fn events(self) -> Vec<Event> {
        match self {
            Self::Single(e) => vec![e],
            Self::Batch { events } => events,
        }
    }
}
pub fn valid_key(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 64
        && s.bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"_-./".contains(&b))
}
impl Event {
    pub fn validate(&mut self, now: DateTime<Utc>, retention: i64) -> ApiResult<()> {
        if !valid_key(&self.event_id) || !valid_key(&self.name) || !valid_key(&self.source) {
            return Err(ApiError::bad(
                "event_id, name and source require 1–64 ASCII letters, digits, _, -, . or /",
            ));
        }
        let time = self.timestamp.get_or_insert(now);
        if *time > now + chrono::Duration::minutes(5)
            || *time < now - chrono::Duration::days(retention)
        {
            return Err(ApiError::bad(
                "timestamp is outside product retention or more than 5 minutes in the future",
            ));
        }
        if self
            .actor_id
            .as_ref()
            .is_some_and(|s| s.is_empty() || s.len() > 128)
            || self
                .session_id
                .as_ref()
                .is_some_and(|s| s.is_empty() || s.len() > 128)
        {
            return Err(ApiError::bad(
                "actor_id and session_id require 1–128 characters",
            ));
        }
        if self.actor_id.is_some() != self.identity_kind.is_some()
            || self
                .identity_kind
                .as_ref()
                .is_some_and(|s| !["visitor", "installation", "actor"].contains(&s.as_str()))
        {
            return Err(ApiError::bad(
                "actor_id requires identity_kind: visitor, installation or actor (and vice versa)",
            ));
        }
        if self.session_id.is_some() && self.identity_kind.as_deref() != Some("visitor") {
            return Err(ApiError::bad(
                "session_id is only valid with a visitor identity",
            ));
        }
        if self.properties.len() > 32 {
            return Err(ApiError::bad("Maximum 32 properties"));
        }
        for (key, value) in &self.properties {
            if !valid_key(key)
                || !(value.is_boolean()
                    || value.is_number()
                    || value.as_str().is_some_and(|s| s.len() <= 2048))
            {
                return Err(ApiError::bad(
                    "Properties must be flat strings (≤2048 bytes), numbers or booleans, with valid keys",
                ));
            }
        }
        Ok(())
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Product {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub retention_days: i64,
    pub created_at: String,
}
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ProductInput {
    pub name: String,
    pub kind: String,
    pub retention_days: i64,
}
impl ProductInput {
    pub fn validate(&self) -> ApiResult<()> {
        if self.name.trim().is_empty()
            || self.name.len() > 80
            || !["website", "tool", "generic"].contains(&self.kind.as_str())
            || !(1..=3650).contains(&self.retention_days)
        {
            return Err(ApiError::bad(
                "Use a name of 1–80 bytes, kind website/tool/generic, and retention_days 1–3650",
            ));
        }
        Ok(())
    }
}
#[derive(Debug, Serialize)]
pub struct KeyInfo {
    pub id: String,
    pub label: String,
    pub prefix: String,
    pub created_at: String,
    pub revoked: bool,
}
#[derive(Debug, Serialize, Deserialize)]
pub struct Ack {
    pub accepted: usize,
    pub duplicates: usize,
}
