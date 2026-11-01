use crate::{
    error::{ApiError, ApiResult},
    model::{KeyInfo, Product, ProductInput},
};
use anyhow::Result;
use duckdb::Connection;
use rusqlite::{OptionalExtension, params};
use sha2::{Digest, Sha256};
use std::{
    path::{Path, PathBuf},
    sync::Arc,
    time::Duration,
};

pub fn hash(value: &str) -> String {
    format!("{:x}", Sha256::digest(value.as_bytes()))
}
pub fn secret(prefix: &str) -> String {
    format!(
        "{prefix}{}{}",
        uuid::Uuid::new_v4().simple(),
        uuid::Uuid::new_v4().simple()
    )
}
pub struct Store {
    pub changes: crate::changes::Changes,
    pub sqlite_path: PathBuf,
    pub analytics: crate::product_db::ProductDatabases,
    pub query_slots: Arc<tokio::sync::Semaphore>,
    pub state_slots: Arc<tokio::sync::Semaphore>,
}
impl Store {
    pub fn open(path: &Path, queries: usize) -> Result<Arc<Self>> {
        std::fs::create_dir_all(path)?;
        let sqlite_path = path.join("state.sqlite");
        let sql = rusqlite::Connection::open(&sqlite_path)?;
        sql.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
          CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL, retention_days INTEGER NOT NULL, created_at TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS ingestion_keys(id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), label TEXT NOT NULL, prefix TEXT NOT NULL, hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, revoked INTEGER NOT NULL DEFAULT 0);
          DROP TABLE IF EXISTS sessions; CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
          PRAGMA user_version=1;")?;
        let analytics = crate::product_db::ProductDatabases::new(path.join("products"))?;
        let migrated = sql
            .query_row(
                "SELECT value FROM settings WHERE key='product_databases_migrated'",
                [],
                |r| r.get::<_, String>(0),
            )
            .optional()?;
        if path.join("events.duckdb").exists() && migrated.is_none() {
            let imported = analytics.import_legacy(&path.join("events.duckdb"))?;
            sql.execute(
                "INSERT INTO settings VALUES ('product_databases_migrated','1')",
                [],
            )?;
            tracing::info!(
                imported,
                "Migrated analytics to separate product databases; original file retained"
            );
        }
        Ok(Arc::new(Self {
            changes: crate::changes::Changes::default(),
            sqlite_path,
            analytics,
            query_slots: Arc::new(tokio::sync::Semaphore::new(queries)),
            state_slots: Arc::new(tokio::sync::Semaphore::new(16)),
        }))
    }
    pub fn sqlite(&self) -> Result<rusqlite::Connection> {
        let conn = rusqlite::Connection::open(&self.sqlite_path)?;
        conn.busy_timeout(Duration::from_secs(2))?;
        conn.execute_batch("PRAGMA foreign_keys=ON;")?;
        Ok(conn)
    }
    pub async fn state<T: Send + 'static>(
        self: &Arc<Self>,
        f: impl FnOnce(&rusqlite::Connection) -> ApiResult<T> + Send + 'static,
    ) -> ApiResult<T> {
        let permit = self
            .state_slots
            .clone()
            .try_acquire_owned()
            .map_err(|_| ApiError::busy())?;
        let store = self.clone();
        tokio::task::spawn_blocking(move || {
            let _permit = permit;
            let db = store.sqlite()?;
            f(&db)
        })
        .await
        .map_err(|e| ApiError::from(anyhow::anyhow!(e)))?
    }
    pub async fn query<T: Send + 'static>(
        self: &Arc<Self>,
        product_id: String,
        f: impl FnOnce(&mut Connection) -> ApiResult<T> + Send + 'static,
    ) -> ApiResult<T> {
        let permit = self
            .query_slots
            .clone()
            .try_acquire_owned()
            .map_err(|_| ApiError::busy())?;
        let store = self.clone();
        tokio::task::spawn_blocking(move || {
            let _permit = permit;
            let mut lease = store.analytics.connection(&product_id)?;
            // Pin the product instance and admission permit until actual completion.
            f(&mut lease.connection)
        })
        .await
        .map_err(|e| ApiError::from(anyhow::anyhow!(e)))?
    }
}
pub fn product(db: &rusqlite::Connection, id: &str) -> ApiResult<Product> {
    db.query_row(
        "SELECT id,name,kind,retention_days,created_at FROM products WHERE id=?",
        [id],
        row_product,
    )
    .optional()
    .map_err(anyhow::Error::from)?
    .ok_or_else(ApiError::missing)
}
fn row_product(r: &rusqlite::Row<'_>) -> rusqlite::Result<Product> {
    Ok(Product {
        id: r.get(0)?,
        name: r.get(1)?,
        kind: r.get(2)?,
        retention_days: r.get(3)?,
        created_at: r.get(4)?,
    })
}
pub fn products(db: &rusqlite::Connection) -> ApiResult<Vec<Product>> {
    let mut q = db
        .prepare(
            "SELECT id,name,kind,retention_days,created_at FROM products ORDER BY created_at,id",
        )
        .map_err(anyhow::Error::from)?;
    q.query_map([], row_product)
        .map_err(anyhow::Error::from)?
        .collect::<rusqlite::Result<_>>()
        .map_err(|e| anyhow::Error::from(e).into())
}
pub fn save_product(
    db: &rusqlite::Connection,
    id: Option<String>,
    input: ProductInput,
) -> ApiResult<Product> {
    input.validate()?;
    let id = match id {
        Some(id) => {
            product(db, &id)?;
            id
        }
        None => uuid::Uuid::new_v4().to_string(),
    };
    db.execute("INSERT INTO products VALUES (?1,?2,?3,?4,?5) ON CONFLICT(id) DO UPDATE SET name=?2,kind=?3,retention_days=?4",params![id,input.name.trim(),input.kind,input.retention_days,chrono::Utc::now().to_rfc3339()]).map_err(anyhow::Error::from)?;
    product(db, &id)
}
pub fn create_key(
    db: &rusqlite::Connection,
    id: &str,
    label: &str,
) -> ApiResult<serde_json::Value> {
    product(db, id)?;
    if label.trim().is_empty() || label.len() > 80 {
        return Err(ApiError::bad("Key label must be 1–80 bytes"));
    }
    let key = secret("pk_");
    let key_id = uuid::Uuid::new_v4().to_string();
    db.execute("INSERT INTO ingestion_keys(id,product_id,label,prefix,hash,created_at) VALUES (?,?,?,?,?,?)",params![key_id,id,label.trim(),&key[..11],hash(&key),chrono::Utc::now().to_rfc3339()]).map_err(anyhow::Error::from)?;
    Ok(serde_json::json!({"id":key_id,"key":key}))
}
pub fn keys(db: &rusqlite::Connection, id: &str) -> ApiResult<Vec<KeyInfo>> {
    product(db, id)?;
    let mut q=db.prepare("SELECT id,label,prefix,created_at,revoked FROM ingestion_keys WHERE product_id=? ORDER BY created_at").map_err(anyhow::Error::from)?;
    q.query_map([id], |r| {
        Ok(KeyInfo {
            id: r.get(0)?,
            label: r.get(1)?,
            prefix: r.get(2)?,
            created_at: r.get(3)?,
            revoked: r.get(4)?,
        })
    })
    .map_err(anyhow::Error::from)?
    .collect::<rusqlite::Result<_>>()
    .map_err(|e| anyhow::Error::from(e).into())
}
pub fn resolve_key(db: &rusqlite::Connection, key: &str) -> ApiResult<Product> {
    let id: Option<String> = db
        .query_row(
            "SELECT product_id FROM ingestion_keys WHERE hash=? AND revoked=0",
            [hash(key)],
            |r| r.get(0),
        )
        .optional()
        .map_err(anyhow::Error::from)?;
    product(db, &id.ok_or_else(ApiError::unauthorized)?)
}
