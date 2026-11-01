use crate::{
    error::{ApiError, ApiResult},
    model::{Ack, Event},
    store::Store,
};
use chrono::Utc;
use duckdb::{Connection, params};
use std::{
    sync::{
        Arc,
        mpsc::{self, SyncSender},
    },
    time::{Duration, Instant},
};
use tokio::sync::oneshot;

pub enum Write {
    Events {
        product_id: String,
        events: Vec<Event>,
        received_at: i64,
        ack: oneshot::Sender<ApiResult<Ack>>,
    },
    Cleanup {
        ack: oneshot::Sender<ApiResult<usize>>,
    },
    Stop {
        ack: oneshot::Sender<()>,
    },
}
#[derive(Clone)]
pub struct Writer {
    tx: SyncSender<Write>,
}
impl Writer {
    pub fn start(db: Connection, store: Arc<Store>, capacity: usize) -> Self {
        let (tx, rx) = mpsc::sync_channel::<Write>(capacity);
        std::thread::Builder::new()
            .name("piko-writer".into())
            .spawn(move || {
                let mut db = db;
                while let Ok(first) = rx.recv() {
                    let mut batch = vec![first];
                    let deadline = Instant::now() + Duration::from_millis(8);
                    while batch.len() < 16 && Instant::now() < deadline {
                        match rx.recv_timeout(deadline.saturating_duration_since(Instant::now())) {
                            Ok(item) => batch.push(item),
                            Err(_) => break,
                        }
                    }
                    let mut events = Vec::new();
                    let mut controls = Vec::new();
                    for item in batch {
                        match item {
                            Write::Events { .. } => events.push(item),
                            _ => controls.push(item),
                        }
                    }
                    if !events.is_empty() {
                        persist(&mut db, events);
                    }
                    for item in controls {
                        match item {
                            Write::Cleanup { ack } => {
                                let _ = ack.send(cleanup(
                                    &mut db,
                                    &store,
                                    Utc::now().timestamp_millis(),
                                ));
                            }
                            Write::Stop { ack } => {
                                let _ = db.execute_batch("CHECKPOINT;");
                                let _ = ack.send(());
                                return;
                            }
                            _ => {}
                        }
                    }
                }
            })
            .expect("start database writer");
        Self { tx }
    }
    pub async fn ingest(&self, product_id: String, events: Vec<Event>) -> ApiResult<Ack> {
        let (ack, rx) = oneshot::channel();
        self.tx
            .try_send(Write::Events {
                product_id,
                events,
                received_at: Utc::now().timestamp_millis(),
                ack,
            })
            .map_err(|_| ApiError::busy())?;
        tokio::time::timeout(Duration::from_secs(10), rx)
            .await
            .map_err(|_| ApiError::busy())?
            .map_err(|_| ApiError::busy())?
    }
    pub async fn cleanup(&self) -> ApiResult<usize> {
        let (ack, rx) = oneshot::channel();
        self.tx
            .try_send(Write::Cleanup { ack })
            .map_err(|_| ApiError::busy())?;
        rx.await.map_err(|_| ApiError::busy())?
    }
    pub async fn stop(&self) {
        let (ack, rx) = oneshot::channel();
        if self.tx.try_send(Write::Stop { ack }).is_ok() {
            let _ = rx.await;
        }
    }
}
fn persist(db: &mut Connection, batch: Vec<Write>) {
    let result = (|| -> anyhow::Result<Vec<Ack>> {
        let tx = db.transaction()?;
        tx.execute_batch("CREATE TEMP TABLE IF NOT EXISTS ingest_buffer AS SELECT *, 0::BIGINT AS request_no, 0::BIGINT AS sequence FROM events WHERE false; DELETE FROM ingest_buffer;")?;
        let mut acks = Vec::new();
        {
            let mut append = tx.appender("ingest_buffer")?;
            let mut sequence = 0_i64;
            for (request_no, item) in batch.iter().enumerate() {
                if let Write::Events {
                    product_id,
                    events,
                    received_at,
                    ..
                } = item
                {
                    for e in events {
                        append.append_row(params![
                            product_id,
                            e.event_id,
                            e.name,
                            e.source,
                            e.timestamp
                                .context("validated event time")?
                                .timestamp_millis(),
                            received_at,
                            e.actor_id,
                            e.identity_kind,
                            e.session_id,
                            serde_json::to_string(&e.properties)?,
                            request_no as i64,
                            sequence
                        ])?;
                        sequence += 1;
                    }
                    acks.push(Ack {
                        accepted: 0,
                        duplicates: events.len(),
                    });
                }
            }
            append.flush()?;
        }
        // One vectorized insert, first occurrence wins within and across requests.
        tx.execute_batch("CREATE OR REPLACE TEMP TABLE accepted_events AS
            SELECT b.* FROM ingest_buffer b WHERE NOT EXISTS
            (SELECT 1 FROM events e WHERE e.product_id=b.product_id AND e.event_id=b.event_id)
            QUALIFY row_number() OVER (PARTITION BY product_id,event_id ORDER BY sequence)=1;
            INSERT INTO events SELECT product_id,event_id,name,source,event_time,received_at,actor_id,identity_kind,session_id,properties FROM accepted_events;")?;
        {
            let mut counts =
                tx.prepare("SELECT request_no,count(*) FROM accepted_events GROUP BY request_no")?;
            let rows =
                counts.query_map([], |r| Ok((r.get::<_, usize>(0)?, r.get::<_, usize>(1)?)))?;
            for row in rows {
                let (index, count) = row?;
                acks[index].accepted = count;
                acks[index].duplicates -= count;
            }
        }
        tx.commit()?;
        Ok(acks)
    })();
    match result {
        Ok(acks) => {
            for (item, result) in batch.into_iter().zip(acks) {
                if let Write::Events { ack, .. } = item {
                    let _ = ack.send(Ok(result));
                }
            }
        }
        Err(e) => {
            tracing::error!(error=%e,"Ingestion transaction rolled back");
            for item in batch {
                if let Write::Events { ack, .. } = item {
                    let _ = ack.send(Err(ApiError::from(anyhow::anyhow!(
                        "Ingestion transaction failed"
                    ))));
                }
            }
        }
    }
}
use anyhow::Context;
pub fn cleanup(db: &mut Connection, store: &Store, now: i64) -> ApiResult<usize> {
    let sql = store.sqlite()?;
    let products = crate::store::products(&sql)?;
    let tx = db.transaction().map_err(anyhow::Error::from)?;
    let mut removed = 0;
    for p in products {
        removed += tx
            .execute(
                "DELETE FROM events WHERE product_id=? AND event_time<?",
                params![p.id, now - p.retention_days * 86_400_000],
            )
            .map_err(anyhow::Error::from)?;
    }
    tx.commit().map_err(anyhow::Error::from)?;
    sql.execute("DELETE FROM sessions WHERE expires<?", [now])
        .map_err(anyhow::Error::from)?;
    Ok(removed)
}
