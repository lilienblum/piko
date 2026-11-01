use crate::{
    error::{ApiError, ApiResult},
    model::{Source, SourceInput},
};
use rusqlite::{OptionalExtension, params};

pub fn migrate(db: &mut rusqlite::Connection) -> anyhow::Result<()> {
    let tx = db.transaction()?;
    tx.execute_batch(
        "CREATE TABLE IF NOT EXISTS sources(
        id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id),
        name TEXT NOT NULL COLLATE NOCASE, kind TEXT NOT NULL, created_at TEXT NOT NULL,
        UNIQUE(product_id,name));",
    )?;
    let has_source = tx
        .prepare("PRAGMA table_info(ingestion_keys)")?
        .query_map([], |r| r.get::<_, String>(1))?
        .collect::<rusqlite::Result<Vec<_>>>()?
        .iter()
        .any(|name| name == "source_id");
    if !has_source {
        tx.execute_batch(
            "ALTER TABLE ingestion_keys ADD COLUMN source_id TEXT REFERENCES sources(id);",
        )?;
    }
    // The project ID is the stable initial source ID, including for historical event rows.
    tx.execute_batch("INSERT OR IGNORE INTO sources(id,product_id,name,kind,created_at)
        SELECT id,id,CASE kind WHEN 'website' THEN 'Website' WHEN 'tool' THEN 'CLI' WHEN 'mobile' THEN 'Mobile app' ELSE 'Events' END,kind,created_at FROM products;
        UPDATE ingestion_keys SET source_id=product_id WHERE source_id IS NULL;
        PRAGMA user_version=2;")?;
    tx.commit()?;
    Ok(())
}
fn row(r: &rusqlite::Row<'_>) -> rusqlite::Result<Source> {
    Ok(Source {
        id: r.get(0)?,
        product_id: r.get(1)?,
        name: r.get(2)?,
        kind: r.get(3)?,
        created_at: r.get(4)?,
    })
}
pub fn list(db: &rusqlite::Connection, product_id: &str) -> ApiResult<Vec<Source>> {
    db.prepare("SELECT id,product_id,name,kind,created_at FROM sources WHERE product_id=? ORDER BY created_at,id")
        .map_err(anyhow::Error::from)?.query_map([product_id], row).map_err(anyhow::Error::from)?
        .collect::<rusqlite::Result<_>>().map_err(|e| anyhow::Error::from(e).into())
}
pub fn get(db: &rusqlite::Connection, product_id: &str, id: &str) -> ApiResult<Source> {
    db.query_row(
        "SELECT id,product_id,name,kind,created_at FROM sources WHERE product_id=? AND id=?",
        [product_id, id],
        row,
    )
    .optional()
    .map_err(anyhow::Error::from)?
    .ok_or_else(ApiError::missing)
}
pub fn save(
    db: &rusqlite::Connection,
    product_id: &str,
    id: Option<String>,
    input: SourceInput,
) -> ApiResult<Source> {
    input.validate()?;
    crate::store::product(db, product_id)?;
    if let Some(id) = &id {
        get(db, product_id, id)?;
    }
    let id = id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    db.execute("INSERT INTO sources(id,product_id,name,kind,created_at) VALUES (?1,?2,?3,?4,?5) ON CONFLICT(id) DO UPDATE SET name=?3,kind=?4", params![id,product_id,input.name.trim(),input.kind,chrono::Utc::now().to_rfc3339()])
        .map_err(|error| match &error {
            rusqlite::Error::SqliteFailure(code, _) if code.extended_code == rusqlite::ffi::SQLITE_CONSTRAINT_UNIQUE => ApiError::bad("A source with that name already exists in this project"),
            _ => ApiError::from(anyhow::Error::from(error)),
        })?;
    get(db, product_id, &id)
}
