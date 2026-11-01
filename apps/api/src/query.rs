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
            || !["hour", "day", "week", "month"].contains(&self.bucket.as_str())
            || (self.bucket == "hour" && span > chrono::Duration::days(31))
            || self.page_size == 0
            || self.page_size > 100
            || self.page > 10_000
            || self.filters.len() > 8
        {
            return Err(ApiError::bad(
                "Use hour/day/week/month buckets, a positive range ≤366 days (hourly ≤31 days), page ≤10000, page_size 1–100, and ≤8 filters",
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
    // The bucket is allowlisted above. Calendar intervals keep weeks aligned to
    // Monday and months aligned to their real UTC boundaries, including leap years.
    let buckets = {
        let bucket = &q.bucket;
        let missing = if ["count", "actors", "sum"].contains(&q.measure.as_str()) {
            "0.0"
        } else {
            "NULL"
        };
        let mut stmt = tx.prepare(&format!(
            "WITH buckets AS (
                SELECT epoch_ms(t) AS time FROM generate_series(
                    date_trunc('{bucket}', epoch_ms(?)),
                    epoch_ms(?) - INTERVAL '1 millisecond',
                    INTERVAL '1 {bucket}'
                ) AS ticks(t)
             ), measured AS (
                SELECT epoch_ms(date_trunc('{bucket}', epoch_ms(event_time))) AS time,
                       cast({measure} AS DOUBLE) AS value
                FROM events WHERE {pred} GROUP BY time
             )
             SELECT buckets.time, CASE WHEN measured.time IS NULL THEN {missing} ELSE measured.value END
             FROM buckets LEFT JOIN measured USING (time) ORDER BY buckets.time"
        )).map_err(anyhow::Error::from)?;
        let series_values = [
            DbValue::BigInt(q.from.timestamp_millis()),
            DbValue::BigInt(q.to.timestamp_millis()),
        ]
        .into_iter()
        .chain(values.iter().cloned());
        stmt.query_map(params_from_iter(series_values), |r| {
            Ok(json!({"time": r.get::<_, i64>(0)?, "value": r.get::<_, Option<f64>>(1)?}))
        })
        .map_err(anyhow::Error::from)?
        .collect::<duckdb::Result<Vec<_>>>()
        .map_err(anyhow::Error::from)?
    };
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
    #[test]
    fn calendar_buckets_preserve_boundaries_types_and_distinct_actors() {
        let dir = tempfile::tempdir().unwrap();
        let store = crate::store::Store::open(dir.path(), 2).unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        let mut db = store.analytics.connection(&id).unwrap();
        for (index, (time, duration, actor)) in [
            ("2024-01-30T23:59:59.999Z", json!(1000), "outside"),
            ("2024-01-31T23:59:59.999Z", json!(10), "one"),
            ("2024-02-01T09:00:00+09:00", json!(30), "one"),
            ("2024-02-29T23:59:59.999Z", json!(50), "two"),
            ("2024-03-01T00:00:00Z", json!("1000"), "two"),
            ("2024-04-01T00:00:00Z", json!(90), "outside"),
        ]
        .into_iter()
        .enumerate()
        {
            let time = DateTime::parse_from_rfc3339(time)
                .unwrap()
                .timestamp_millis();
            db.connection.execute(
                "INSERT INTO events(product_id,event_id,name,source,event_time,received_at,actor_id,identity_kind,properties) VALUES (?,?,'command_run','cli',?,?,?,'installation',?)",
                duckdb::params![id, index.to_string(), time, time, actor, json!({"duration_ms":duration}).to_string()],
            ).unwrap();
        }
        let query = |bucket: &str, measure: &str| -> Query {
            serde_json::from_value(json!({
                "from":"2024-01-31T00:00:00Z", "to":"2024-04-01T00:00:00Z",
                "bucket":bucket, "measure":measure, "property":"duration_ms"
            }))
            .unwrap()
        };
        let point = |time: &str, value: Value| {
            json!({
                "time":DateTime::parse_from_rfc3339(time).unwrap().timestamp_millis(), "value":value
            })
        };
        let count = run(&mut db.connection, &id, query("month", "count")).unwrap();
        assert_eq!(count["summary"]["total"], 4);
        assert_eq!(
            count["series"],
            json!([
                point("2024-01-01T00:00:00Z", json!(1.0)),
                point("2024-02-01T00:00:00Z", json!(2.0)),
                point("2024-03-01T00:00:00Z", json!(1.0)),
            ])
        );
        let avg = run(&mut db.connection, &id, query("month", "avg")).unwrap();
        assert_eq!(avg["series"][1]["value"], 40.0);
        assert!(avg["series"][2]["value"].is_null());
        let p95 = run(&mut db.connection, &id, query("month", "p95")).unwrap();
        assert_eq!(p95["series"][1]["value"], 49.0);
        let actors = run(&mut db.connection, &id, query("week", "actors")).unwrap();
        let series = actors["series"].as_array().unwrap();
        assert_eq!(series.len(), 9);
        assert_eq!(series[0], point("2024-01-29T00:00:00Z", json!(1.0)));
        assert_eq!(series[1]["value"], 0.0);
        assert_eq!(series[4], point("2024-02-26T00:00:00Z", json!(1.0)));
        let weekly_average = run(&mut db.connection, &id, query("week", "avg")).unwrap();
        assert_eq!(weekly_average["series"][0]["value"], 20.0);
        assert!(weekly_average["series"][1]["value"].is_null());
        let mut year_boundary = query("week", "count");
        year_boundary.from = "2023-12-31T00:00:00Z".parse().unwrap();
        year_boundary.to = "2024-01-09T00:00:00Z".parse().unwrap();
        let empty = run(&mut db.connection, &id, year_boundary).unwrap();
        assert_eq!(
            empty["series"],
            json!([
                point("2023-12-25T00:00:00Z", json!(0.0)),
                point("2024-01-01T00:00:00Z", json!(0.0)),
                point("2024-01-08T00:00:00Z", json!(0.0)),
            ])
        );
        let mut filtered = query("month", "count");
        filtered.filters.push(Filter {
            property: "duration_ms".into(),
            op: "gt".into(),
            value: json!(20),
        });
        let filtered = run(&mut db.connection, &id, filtered).unwrap();
        assert_eq!(filtered["series"][0]["value"], 0.0);
        assert_eq!(filtered["series"][1]["value"], 2.0);
        assert_eq!(filtered["series"][2]["value"], 0.0);
        let mut invalid = query("quarter", "count");
        assert!(invalid.validate().is_err());
        invalid.bucket = "month'); DROP TABLE events; --".into();
        assert!(invalid.validate().is_err());
    }
}
