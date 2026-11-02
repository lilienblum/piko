use crate::{
    error::{ApiError, ApiResult},
    model::{Source, SourceInput},
};
use rusqlite::{OptionalExtension, params};

pub fn migrate(db: &mut rusqlite::Connection) -> anyhow::Result<()> {
    let version: i64 = db.query_row("PRAGMA user_version", [], |row| row.get(0))?;
    anyhow::ensure!(
        version <= 6,
        "Catalog schema is newer than this API supports"
    );
    if version == 6 {
        return Ok(());
    }
    let tx = db.transaction()?;
    if version < 3 {
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
        ALTER TABLE sources ADD COLUMN icon TEXT;
        ALTER TABLE sources DROP COLUMN kind;
        ALTER TABLE products DROP COLUMN kind;
        PRAGMA user_version=3;")?;
    }
    if version < 4 {
        tx.execute_batch(
            "ALTER TABLE ingestion_keys ADD COLUMN allowed_origins TEXT NOT NULL DEFAULT '[]';",
        )?;
    }
    if version < 5 {
        tx.execute_batch("ALTER TABLE products ADD COLUMN website_url TEXT; ALTER TABLE products ADD COLUMN favicon BLOB; ALTER TABLE products ADD COLUMN favicon_version TEXT;")?;
    }
    tx.execute_batch("ALTER TABLE products ADD COLUMN slug TEXT NOT NULL DEFAULT '';")?;
    let projects = tx
        .prepare("SELECT id,name FROM products ORDER BY created_at,id")?
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    for (id, name) in projects {
        let base = crate::store::project_slug(&name);
        let mut slug = base.clone();
        let mut suffix = 2;
        while tx.query_row(
            "SELECT EXISTS(SELECT 1 FROM products WHERE slug=?)",
            [&slug],
            |r| r.get::<_, bool>(0),
        )? {
            slug = format!("{base}-{suffix}");
            suffix += 1;
        }
        tx.execute("UPDATE products SET slug=? WHERE id=?", params![slug, id])?;
    }
    tx.execute_batch(
        "CREATE UNIQUE INDEX products_slug ON products(slug); PRAGMA user_version=6;",
    )?;
    tx.commit()?;
    Ok(())
}
fn row(r: &rusqlite::Row<'_>) -> rusqlite::Result<Source> {
    Ok(Source {
        id: r.get(0)?,
        product_id: r.get(1)?,
        name: r.get(2)?,
        icon: r.get(3)?,
        created_at: r.get(4)?,
    })
}
pub fn list(db: &rusqlite::Connection, product_id: &str) -> ApiResult<Vec<Source>> {
    db.prepare("SELECT id,product_id,name,icon,created_at FROM sources WHERE product_id=? ORDER BY created_at,id")
        .map_err(anyhow::Error::from)?.query_map([product_id], row).map_err(anyhow::Error::from)?
        .collect::<rusqlite::Result<_>>().map_err(|e| anyhow::Error::from(e).into())
}
pub fn get(db: &rusqlite::Connection, product_id: &str, id: &str) -> ApiResult<Source> {
    db.query_row(
        "SELECT id,product_id,name,icon,created_at FROM sources WHERE product_id=? AND id=?",
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
    db.execute("INSERT INTO sources(id,product_id,name,icon,created_at) VALUES (?1,?2,?3,?4,?5) ON CONFLICT(id) DO UPDATE SET name=?3,icon=?4", params![id,product_id,input.name.trim(),input.icon,chrono::Utc::now().to_rfc3339()])
        .map_err(|error| match &error {
            rusqlite::Error::SqliteFailure(code, _) if code.extended_code == rusqlite::ffi::SQLITE_CONSTRAINT_UNIQUE => ApiError::bad("A source with that name already exists in this project"),
            _ => ApiError::from(anyhow::Error::from(error)),
        })?;
    get(db, product_id, &id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn typed_catalog_migration_preserves_sources_keys_and_pinned_icons_on_restart() {
        let mut db = rusqlite::Connection::open_in_memory().unwrap();
        db.execute_batch("PRAGMA foreign_keys=ON;
          CREATE TABLE products(id TEXT PRIMARY KEY,name TEXT NOT NULL,kind TEXT NOT NULL,retention_days INTEGER NOT NULL,created_at TEXT NOT NULL);
          CREATE TABLE sources(id TEXT PRIMARY KEY,product_id TEXT NOT NULL REFERENCES products(id),name TEXT NOT NULL COLLATE NOCASE,kind TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(product_id,name));
          CREATE TABLE ingestion_keys(id TEXT PRIMARY KEY,product_id TEXT NOT NULL REFERENCES products(id),source_id TEXT REFERENCES sources(id),label TEXT NOT NULL,prefix TEXT NOT NULL,hash TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL,revoked INTEGER NOT NULL);
          INSERT INTO products VALUES ('project','Orbit','website',90,'2026-01-01');
          INSERT INTO sources VALUES ('project','project','Website','website','2026-01-01'),('mobile','project','iOS app','mobile','2026-01-02');
          PRAGMA user_version=2;").unwrap();
        db.execute("INSERT INTO ingestion_keys VALUES ('key','project','mobile','Release','pk_existing',?,'2026-01-02',0)", [crate::store::hash("pk_existing")]).unwrap();
        migrate(&mut db).unwrap();
        let sources = list(&db, "project").unwrap();
        assert_eq!(sources.len(), 2);
        assert_eq!(sources[1].id, "mobile");
        assert_eq!(sources[1].name, "iOS app");
        assert_eq!(sources[1].icon, None);
        assert_eq!(
            crate::store::resolve_key(&db, "pk_existing", None)
                .unwrap()
                .1,
            "mobile"
        );
        for table in ["products", "sources"] {
            let columns = db
                .prepare(&format!("PRAGMA table_info({table})"))
                .unwrap()
                .query_map([], |row| row.get::<_, String>(1))
                .unwrap()
                .collect::<rusqlite::Result<Vec<_>>>()
                .unwrap();
            assert!(!columns.iter().any(|name| name == "kind"));
        }
        save(
            &db,
            "project",
            Some("mobile".into()),
            SourceInput {
                name: "Android app".into(),
                icon: Some("ios".into()),
            },
        )
        .unwrap();
        migrate(&mut db).unwrap();
        assert_eq!(
            get(&db, "project", "mobile").unwrap().icon.as_deref(),
            Some("ios")
        );
        assert_eq!(
            crate::store::resolve_key(&db, "pk_existing", None)
                .unwrap()
                .1,
            "mobile"
        );
        save(
            &db,
            "project",
            Some("mobile".into()),
            SourceInput {
                name: "Android app".into(),
                icon: None,
            },
        )
        .unwrap();
        assert_eq!(get(&db, "project", "mobile").unwrap().icon, None);
        assert_eq!(
            db.query_row("SELECT count(*) FROM pragma_foreign_key_check", [], |row| {
                row.get::<_, i64>(0)
            })
            .unwrap(),
            0
        );
    }
}
