//! One physical analytical database per product, with a bounded, pinned LRU cache.
use crate::error::{ApiError, ApiResult};
use anyhow::Result;
use duckdb::{Connection, params};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::Instant,
};
const MAX_OPEN: usize = 8;
const SCHEMA: &str = "CREATE TABLE IF NOT EXISTS events(product_id VARCHAR NOT NULL, event_id VARCHAR NOT NULL, name VARCHAR NOT NULL, source VARCHAR NOT NULL, event_time BIGINT NOT NULL, received_at BIGINT NOT NULL, actor_id VARCHAR, identity_kind VARCHAR, session_id VARCHAR, properties JSON NOT NULL, PRIMARY KEY(product_id,event_id));";
struct Database {
    root: Mutex<Connection>,
}
struct Entry {
    database: Arc<Database>,
    used: Instant,
}
pub struct ProductDatabases {
    directory: PathBuf,
    cache: Mutex<HashMap<String, Entry>>,
}
// Field order drops the clone before releasing the pin on its root instance.
pub struct Lease {
    pub connection: Connection,
    _pin: Arc<Database>,
}
impl ProductDatabases {
    pub fn new(directory: PathBuf) -> Result<Self> {
        std::fs::create_dir_all(&directory)?;
        Ok(Self {
            directory,
            cache: Mutex::new(HashMap::new()),
        })
    }
    pub fn path(&self, id: &str) -> Result<PathBuf> {
        let id = uuid::Uuid::parse_str(id)?;
        Ok(self.directory.join(format!("{id}.duckdb")))
    }
    pub fn connection(&self, id: &str) -> ApiResult<Lease> {
        let path = self.path(id)?;
        let mut cache = self
            .cache
            .lock()
            .map_err(|_| anyhow::anyhow!("Database cache poisoned"))?;
        if !cache.contains_key(id) {
            if cache.len() >= MAX_OPEN {
                let victim = cache
                    .iter()
                    .filter(|(_, e)| Arc::strong_count(&e.database) == 1)
                    .min_by_key(|(_, e)| e.used)
                    .map(|(id, _)| id.clone())
                    .ok_or_else(ApiError::busy)?;
                cache.remove(&victim);
            }
            let db = Connection::open(path).map_err(anyhow::Error::from)?;
            db.execute_batch(
                "SET threads=2; SET memory_limit='64MB'; SET enable_external_access=false;",
            )
            .map_err(anyhow::Error::from)?;
            db.execute_batch(SCHEMA).map_err(anyhow::Error::from)?;
            // IDs are UUID-validated by path(); existing rows belong to the initial source.
            db.execute_batch(&format!(
                "ALTER TABLE events ADD COLUMN IF NOT EXISTS source_id VARCHAR DEFAULT '{id}';"
            ))
            .map_err(anyhow::Error::from)?;
            cache.insert(
                id.into(),
                Entry {
                    database: Arc::new(Database {
                        root: Mutex::new(db),
                    }),
                    used: Instant::now(),
                },
            );
        }
        let entry = cache.get_mut(id).expect("cached database");
        entry.used = Instant::now();
        let pin = entry.database.clone();
        let connection = pin
            .root
            .lock()
            .map_err(|_| anyhow::anyhow!("Database connection poisoned"))?
            .try_clone()
            .map_err(anyhow::Error::from)?;
        Ok(Lease {
            connection,
            _pin: pin,
        })
    }
    pub fn checkpoint(&self) -> Result<()> {
        let cache = self
            .cache
            .lock()
            .map_err(|_| anyhow::anyhow!("Database cache poisoned"))?;
        for entry in cache.values() {
            entry
                .database
                .root
                .lock()
                .map_err(|_| anyhow::anyhow!("Database connection poisoned"))?
                .execute_batch("CHECKPOINT;")?;
        }
        Ok(())
    }
    /// Idempotent import from early MVP builds. Keep the original file as a backup.
    pub fn import_legacy(&self, path: &Path) -> Result<usize> {
        let legacy = Connection::open(path)?;
        let ids = legacy
            .prepare("SELECT DISTINCT product_id FROM events")?
            .query_map([], |r| r.get::<_, String>(0))?
            .collect::<duckdb::Result<Vec<_>>>()?;
        let mut imported = 0;
        for id in ids {
            let mut lease = self.connection(&id).map_err(|e| anyhow::anyhow!(e.1))?;
            let tx = lease.connection.transaction()?;
            tx.execute_batch(
                "CREATE TEMP TABLE migration_buffer AS SELECT * FROM events WHERE false;",
            )?;
            {
                let mut statement=legacy.prepare("SELECT product_id,event_id,name,source,event_time,received_at,actor_id,identity_kind,session_id,cast(properties AS VARCHAR) FROM events WHERE product_id=?")?;
                let mut rows = statement.query([&id])?;
                let mut appender = tx.appender("migration_buffer")?;
                while let Some(r) = rows.next()? {
                    appender.append_row(params![
                        r.get::<_, String>(0)?,
                        r.get::<_, String>(1)?,
                        r.get::<_, String>(2)?,
                        r.get::<_, String>(3)?,
                        r.get::<_, i64>(4)?,
                        r.get::<_, i64>(5)?,
                        r.get::<_, Option<String>>(6)?,
                        r.get::<_, Option<String>>(7)?,
                        r.get::<_, Option<String>>(8)?,
                        r.get::<_, String>(9)?,
                        id
                    ])?;
                }
                appender.flush()?;
            }
            imported += tx.execute(
                "INSERT INTO events SELECT * FROM migration_buffer ON CONFLICT DO NOTHING",
                [],
            )?;
            tx.execute_batch("DROP TABLE migration_buffer;")?;
            tx.commit()?;
        }
        Ok(imported)
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cache_is_bounded_and_does_not_evict_active_connections() {
        let dir = tempfile::tempdir().unwrap();
        let db = ProductDatabases::new(dir.path().to_path_buf()).unwrap();
        let mut leases = Vec::new();
        for _ in 0..MAX_OPEN {
            leases.push(db.connection(&uuid::Uuid::new_v4().to_string()).unwrap());
        }
        assert!(db.connection(&uuid::Uuid::new_v4().to_string()).is_err());
        leases.pop();
        assert!(db.connection(&uuid::Uuid::new_v4().to_string()).is_ok());
        assert_eq!(db.cache.lock().unwrap().len(), MAX_OPEN);
    }
    #[test]
    fn legacy_import_is_idempotent_and_files_are_isolated() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("events.duckdb");
        let old = Connection::open(&path).unwrap();
        old.execute_batch(SCHEMA).unwrap();
        let a = uuid::Uuid::new_v4().to_string();
        let b = uuid::Uuid::new_v4().to_string();
        for id in [&a, &b] {
            old.execute(
                "INSERT INTO events VALUES (?,'same','test','cli',1,2,NULL,NULL,NULL,'{\"n\":3}')",
                [id],
            )
            .unwrap();
        }
        drop(old);
        let db = ProductDatabases::new(dir.path().join("products")).unwrap();
        assert_eq!(db.import_legacy(&path).unwrap(), 2);
        assert_eq!(db.import_legacy(&path).unwrap(), 0);
        for id in [a, b] {
            let lease = db.connection(&id).unwrap();
            let count: i64 = lease
                .connection
                .query_row("SELECT count(*) FROM events", [], |r| r.get(0))
                .unwrap();
            assert_eq!(count, 1);
            let stored: String = lease
                .connection
                .query_row("SELECT product_id FROM events", [], |r| r.get(0))
                .unwrap();
            assert_eq!(stored, id);
            assert!(db.path(&id).unwrap().exists());
        }
    }
}
