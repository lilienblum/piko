use crate::{
    error::{ApiError, ApiResult},
    model::valid_key,
};
use chrono::{DateTime, Utc};
use duckdb::{Connection, params_from_iter, types::Value as DbValue};
use serde::Deserialize;
use serde_json::{Value, json};

#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Filter {
    pub property: String,
    pub op: String,
    pub value: Value,
}
#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Query {
    pub from: DateTime<Utc>,
    pub to: DateTime<Utc>,
    #[serde(default = "day")]
    pub bucket: String,
    pub event: Option<String>,
    pub source: Option<String>,
    pub source_id: Option<String>,
    pub identity_kind: Option<String>,
    #[serde(default = "count")]
    pub measure: String,
    pub property: Option<String>,
    pub group_by: Option<String>,
    #[serde(default)]
    pub filters: Vec<Filter>,
    #[serde(default)]
    pub page: usize,
    #[serde(default = "page_size")]
    pub page_size: usize,
}
fn day() -> String {
    "day".into()
}
fn count() -> String {
    "count".into()
}
fn page_size() -> usize {
    25
}
pub fn numeric(key: &str) -> String {
    format!(
        "CASE WHEN json_type(properties, '$.\"{key}\"') IN ('BIGINT','UBIGINT','DOUBLE') THEN try_cast(json_extract(properties, '$.\"{key}\"') AS DOUBLE) END"
    )
}
fn property(key: &str) -> ApiResult<String> {
    if !valid_key(key) {
        return Err(ApiError::bad("Invalid property key"));
    }
    Ok(format!("json_extract(properties, '$.\"{key}\"')"))
}
impl Query {
    pub fn validate(&self) -> ApiResult<()> {
        let span = self.to.signed_duration_since(self.from);
        if span.num_milliseconds() <= 0
            || span > chrono::Duration::days(366)
            || !["hour", "day"].contains(&self.bucket.as_str())
            || (self.bucket == "hour" && span > chrono::Duration::days(31))
            || self.page_size == 0
            || self.page_size > 100
            || self.page > 10_000
            || self.filters.len() > 8
        {
            return Err(ApiError::bad(
                "Use a positive range ≤366 days (hourly ≤31 days), page ≤10000, page_size 1–100, and ≤8 filters",
            ));
        }
        if !["count", "actors", "sum", "avg", "p50", "p95"].contains(&self.measure.as_str()) {
            return Err(ApiError::bad("Unsupported measure"));
        }
        if ["sum", "avg", "p50", "p95"].contains(&self.measure.as_str()) {
            property(
                self.property
                    .as_deref()
                    .ok_or_else(|| ApiError::bad("Numeric measures need a property"))?,
            )?;
        }
        Ok(())
    }
    fn predicate(&self, id: &str) -> ApiResult<(String, Vec<DbValue>)> {
        let mut sql = "product_id=? AND event_time>=? AND event_time<?".to_string();
        let mut values = vec![
            DbValue::Text(id.into()),
            DbValue::BigInt(self.from.timestamp_millis()),
            DbValue::BigInt(self.to.timestamp_millis()),
        ];
        for (key, value) in [
            ("name", &self.event),
            ("source", &self.source),
            ("source_id", &self.source_id),
            ("identity_kind", &self.identity_kind),
        ] {
            if let Some(value) = value {
                sql += &format!(" AND {key}=?");
                values.push(DbValue::Text(value.clone()));
            }
        }
        for f in &self.filters {
            let expr = property(&f.property)?;
            let op = match f.op.as_str() {
                "eq" => "=",
                "ne" => "!=",
                "gt" => ">",
                "gte" => ">=",
                "lt" => "<",
                "lte" => "<=",
                _ => return Err(ApiError::bad("Filter op must be eq/ne/gt/gte/lt/lte")),
            };
            if f.value.is_number() {
                let n = f
                    .value
                    .as_f64()
                    .ok_or_else(|| ApiError::bad("Invalid number"))?;
                sql += &format!(" AND {} {op} ?", numeric(&f.property));
                values.push(DbValue::Double(n));
            } else if (f.value.is_string() || f.value.is_boolean())
                && ["eq", "ne"].contains(&f.op.as_str())
            {
                sql += &format!(" AND {expr} {op} cast(? AS JSON)");
                values.push(DbValue::Text(f.value.to_string()));
            } else {
                return Err(ApiError::bad(
                    "Ordered comparisons require numbers; eq/ne require scalar values",
                ));
            }
        }
        Ok((sql, values))
    }
}
fn agg(q: &Query) -> String {
    match q.measure.as_str() {
        "actors" => {
            "count(DISTINCT (identity_kind, actor_id)) FILTER (WHERE actor_id IS NOT NULL)".into()
        }
        "sum" | "avg" => format!(
            "{}({})",
            q.measure,
            numeric(q.property.as_deref().expect("validated property"))
        ),
        "p50" | "p95" => format!(
            "quantile_cont({}, {})",
            numeric(q.property.as_deref().expect("validated property")),
            if q.measure == "p50" { 0.5 } else { 0.95 }
        ),
        _ => "count(*)".into(),
    }
}
pub fn run(db: &mut Connection, id: &str, q: Query) -> ApiResult<Value> {
    q.validate()?;
    let (pred, values) = q.predicate(id)?;
    let measure = agg(&q);
    let group = match q.group_by.as_deref().unwrap_or("name") {
        "name" => "to_json(name)".to_string(),
        "source" => "to_json(source)".to_string(),
        "source_id" => "to_json(source_id)".to_string(),
        "identity_kind" => "to_json(identity_kind)".to_string(),
        s if s.starts_with("property:") => property(&s[9..])?,
        _ => {
            return Err(ApiError::bad(
                "Group by name, source, source_id, identity_kind or property:<key>",
            ));
        }
    };
    let tx = db.transaction().map_err(anyhow::Error::from)?;
    let duration = numeric("duration_ms");
    let sql = format!(
        "SELECT count(*), count(DISTINCT (identity_kind,actor_id)) FILTER (WHERE actor_id IS NOT NULL), count(DISTINCT actor_id) FILTER (WHERE identity_kind='visitor'), count(DISTINCT actor_id) FILTER (WHERE identity_kind='installation'), count(DISTINCT (actor_id,session_id)) FILTER (WHERE session_id IS NOT NULL AND identity_kind='visitor'), avg(CASE WHEN json_type(properties,'$.success')='BOOLEAN' THEN CASE WHEN json_extract_string(properties,'$.success')='true' THEN 100.0 ELSE 0.0 END END), avg({duration}), quantile_cont({duration},0.95), cast({measure} AS DOUBLE), count(*) FILTER (WHERE session_id IS NOT NULL AND identity_kind='visitor') FROM events WHERE {pred}"
    );
    let summary=tx.query_row(&sql, params_from_iter(values.iter()),|r|Ok(json!({"total":r.get::<_,i64>(0)?,"actors":r.get::<_,i64>(1)?,"visitors":r.get::<_,i64>(2)?,"installations":r.get::<_,i64>(3)?,"sessions":r.get::<_,i64>(4)?,"success_rate":r.get::<_,Option<f64>>(5)?,"avg_duration":r.get::<_,Option<f64>>(6)?,"p95_duration":r.get::<_,Option<f64>>(7)?,"value":r.get::<_,Option<f64>>(8)?,"session_views":r.get::<_,i64>(9)?}))).map_err(anyhow::Error::from)?;
    let width: i64 = if q.bucket == "hour" {
        3_600_000
    } else {
        86_400_000
    };
    let mut series = std::collections::BTreeMap::new();
    {
        let mut stmt=tx.prepare(&format!("SELECT cast(floor(event_time/{width}) AS BIGINT)*{width} AS bucket, cast({measure} AS DOUBLE) FROM events WHERE {pred} GROUP BY bucket ORDER BY bucket")).map_err(anyhow::Error::from)?;
        let rows = stmt
            .query_map(params_from_iter(values.iter()), |r| {
                Ok((r.get::<_, i64>(0)?, r.get::<_, Option<f64>>(1)?))
            })
            .map_err(anyhow::Error::from)?;
        for row in rows {
            let (t, n) = row.map_err(anyhow::Error::from)?;
            series.insert(t, n);
        }
    }
    let mut buckets = Vec::new();
    let mut t = q.from.timestamp_millis().div_euclid(width) * width;
    while t < q.to.timestamp_millis() {
        let default = if ["count", "actors", "sum"].contains(&q.measure.as_str()) {
            Some(0.0)
        } else {
            None
        };
        buckets.push(json!({"time":t,"value":series.get(&t).copied().unwrap_or(default)}));
        t += width;
    }
    let groups = {
        let mut stmt=tx.prepare(&format!("SELECT cast({group} AS VARCHAR) AS label,cast({measure} AS DOUBLE) AS value,count(*) FROM events WHERE {pred} GROUP BY label ORDER BY value DESC NULLS LAST,label LIMIT 12")).map_err(anyhow::Error::from)?;
        stmt.query_map(params_from_iter(values.iter()),|r|{let raw:Option<String>=r.get(0)?; Ok(json!({"label":raw.and_then(|s|serde_json::from_str::<Value>(&s).ok()),"value":r.get::<_,Option<f64>>(1)?,"count":r.get::<_,i64>(2)?}))}).map_err(anyhow::Error::from)?.collect::<duckdb::Result<Vec<_>>>().map_err(anyhow::Error::from)?
    };
    let events = {
        let mut stmt=tx.prepare(&format!("SELECT event_id,name,source,event_time,received_at,actor_id,identity_kind,session_id,cast(properties AS VARCHAR),source_id FROM events WHERE {pred} ORDER BY event_time DESC,event_id DESC LIMIT {} OFFSET {}",q.page_size,q.page*q.page_size)).map_err(anyhow::Error::from)?;
        stmt.query_map(params_from_iter(values.iter()),|r|{let props:String=r.get(8)?;Ok(json!({"source_id":r.get::<_,String>(9)?,"event_id":r.get::<_,String>(0)?,"name":r.get::<_,String>(1)?,"source":r.get::<_,String>(2)?,"timestamp":r.get::<_,i64>(3)?,"received_at":r.get::<_,i64>(4)?,"actor_id":r.get::<_,Option<String>>(5)?,"identity_kind":r.get::<_,Option<String>>(6)?,"session_id":r.get::<_,Option<String>>(7)?,"properties":serde_json::from_str::<Value>(&props).unwrap_or(Value::Null)}))}).map_err(anyhow::Error::from)?.collect::<duckdb::Result<Vec<_>>>().map_err(anyhow::Error::from)?
    };
    let names = {
        let mut stmt=tx.prepare("SELECT DISTINCT name FROM events WHERE product_id=? AND event_time>=? AND event_time<? AND (? IS NULL OR source_id=?) ORDER BY name LIMIT 100").map_err(anyhow::Error::from)?;
        stmt.query_map(
            duckdb::params![
                id,
                q.from.timestamp_millis(),
                q.to.timestamp_millis(),
                q.source_id.as_deref(),
                q.source_id.as_deref()
            ],
            |r| r.get::<_, String>(0),
        )
        .map_err(anyhow::Error::from)?
        .collect::<duckdb::Result<Vec<_>>>()
        .map_err(anyhow::Error::from)?
    };
    tx.commit().map_err(anyhow::Error::from)?;
    Ok(
        json!({"summary":summary,"series":buckets,"groups":groups,"events":events,"event_names":names,"page":q.page,"page_size":q.page_size,"timezone":"UTC"}),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn range_limits_include_the_fractional_day_or_hour() {
        let mut query: Query = serde_json::from_value(json!({
            "from": "2026-01-01T00:00:00Z", "to": "2026-01-02T00:00:00Z"
        }))
        .unwrap();
        for (bucket, days) in [("day", 366), ("hour", 31)] {
            query.bucket = bucket.into();
            query.to = query.from + chrono::Duration::days(days);
            assert!(query.validate().is_ok());
            query.to += chrono::Duration::milliseconds(1);
            assert!(query.validate().is_err());
        }
    }
}
