use axum::{
    Router,
    body::Body,
    http::{Request, StatusCode},
};
use http_body_util::BodyExt;
use piko::{AppState, Config, router};
use serde_json::{Value, json};
use tower::ServiceExt;
const MANAGEMENT: &str = "";
struct Fixture {
    app: Router,
    state: AppState,
    dir: tempfile::TempDir,
}
impl Fixture {
    fn new(capacity: usize) -> Self {
        let dir = tempfile::tempdir().unwrap();
        let state = AppState::open(&config(dir.path(), capacity)).unwrap();
        let app = router(state.clone());
        Self { app, state, dir }
    }
    async fn product(&self, name: &str) -> (String, String) {
        let (status, p) = call(
            &self.app,
            "POST",
            "/api/products",
            MANAGEMENT,
            json!({"name":name,"retention_days":30}),
        )
        .await;
        assert_eq!(status, StatusCode::OK, "{p}");
        let id = p["id"].as_str().unwrap().to_string();
        let (_, key) = call(
            &self.app,
            "POST",
            &format!("/api/products/{id}/keys"),
            MANAGEMENT,
            json!({"label":"test"}),
        )
        .await;
        (id, key["key"].as_str().unwrap().to_string())
    }
}
fn config(path: &std::path::Path, capacity: usize) -> Config {
    Config {
        data_dir: path.into(),
        query_concurrency: 2,
        queue_capacity: capacity,
    }
}
async fn call(
    app: &Router,
    method: &str,
    path: &str,
    token: &str,
    body: Value,
) -> (StatusCode, Value) {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(method)
                .uri(path)
                .header("content-type", "application/json")
                .header("x-piko-admin", "1")
                .header("authorization", format!("Bearer {token}"))
                .header("origin", "https://website.example")
                .body(Body::from(body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    let status = response.status();
    if path == "/api/ingest" {
        assert_eq!(response.headers()["access-control-allow-origin"], "*");
        assert_eq!(
            response.headers()["access-control-expose-headers"],
            "retry-after"
        );
        if status == StatusCode::SERVICE_UNAVAILABLE {
            assert_eq!(response.headers()["retry-after"], "1");
        }
    }
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    (
        status,
        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
    )
}
fn event(id: &str, n: Value) -> Value {
    json!({"event_id":id,"name":"command_run","source":"cli","actor_id":"anonymous-install","identity_kind":"installation","properties":{"duration_ms":n,"success":true,"command":"build"}})
}
fn range() -> Value {
    json!({"from":(chrono::Utc::now()-chrono::Duration::days(7)).to_rfc3339(),"to":(chrono::Utc::now()+chrono::Duration::minutes(1)).to_rfc3339(),"measure":"count"})
}
#[tokio::test]
async fn durable_deduplicated_scoped_typed_queries() {
    let f = Fixture::new(16);
    let (a, key_a) = f.product("A").await;
    let (b, key_b) = f.product("B").await;
    let batch = json!({"events":[event("one",json!(10)),event("two",json!(30)),event("text",json!("1000"))]});
    let (status, ack) = call(&f.app, "POST", "/api/ingest", &key_a, batch.clone()).await;
    assert_eq!(status, StatusCode::OK, "{ack}");
    assert_eq!(ack["accepted"], 3);
    let (_, ack) = call(&f.app, "POST", "/api/ingest", &key_a, batch).await;
    assert_eq!(ack["duplicates"], 3);
    let (_, ack) = call(
        &f.app,
        "POST",
        "/api/ingest",
        &key_b,
        event("one", json!(90)),
    )
    .await;
    assert_eq!(ack["accepted"], 1);
    let mut q = range();
    q["measure"] = json!("avg");
    q["property"] = json!("duration_ms");
    q["page_size"] = json!(1);
    let (status, r) = call(
        &f.app,
        "POST",
        &format!("/api/products/{a}/query"),
        MANAGEMENT,
        q.clone(),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{r}");
    assert_eq!(r["summary"]["total"], 3);
    assert_eq!(r["summary"]["value"], 20.0);
    assert_eq!(r["summary"]["installations"], 1);
    assert_eq!(r["summary"]["visitors"], 0);
    assert_eq!(r["events"].as_array().unwrap().len(), 1);
    q["measure"] = json!("sum");
    let (_, r) = call(
        &f.app,
        "POST",
        &format!("/api/products/{a}/query"),
        MANAGEMENT,
        q.clone(),
    )
    .await;
    assert_eq!(r["summary"]["value"], 40.0);
    q["measure"] = json!("p95");
    let (_, r) = call(
        &f.app,
        "POST",
        &format!("/api/products/{a}/query"),
        MANAGEMENT,
        q.clone(),
    )
    .await;
    assert_eq!(r["summary"]["value"], 29.0);
    q["filters"] = json!([{"property":"duration_ms","op":"gt","value":15}]);
    let (_, r) = call(
        &f.app,
        "POST",
        &format!("/api/products/{a}/query"),
        MANAGEMENT,
        q,
    )
    .await;
    assert_eq!(r["summary"]["total"], 1);
    let (_, r) = call(
        &f.app,
        "POST",
        &format!("/api/products/{b}/query"),
        MANAGEMENT,
        range(),
    )
    .await;
    assert_eq!(r["summary"]["total"], 1);
    let mut invalid = event("forged", json!(1));
    invalid["product_id"] = json!(b);
    assert_eq!(
        call(&f.app, "POST", "/api/ingest", &key_a, invalid).await.0,
        StatusCode::UNPROCESSABLE_ENTITY
    );
    f.state.writer.stop().await;
    let path = f.dir.path().to_path_buf();
    drop(f.app);
    drop(f.state);
    tokio::time::sleep(std::time::Duration::from_millis(20)).await;
    let state = AppState::open(&config(&path, 16)).unwrap();
    let app = router(state.clone());
    let (_, r) = call(
        &app,
        "POST",
        &format!("/api/products/{a}/query"),
        MANAGEMENT,
        range(),
    )
    .await;
    assert_eq!(r["summary"]["total"], 3);
    state.writer.stop().await;
}
#[tokio::test]
async fn invalid_batch_is_atomic_and_keys_are_revocable() {
    let f = Fixture::new(8);
    let (id, key) = f.product("Validation").await;
    let mut invalid = event("invalid", json!(10));
    invalid["properties"]["nested"] = json!({"no":true});
    assert_eq!(
        call(
            &f.app,
            "POST",
            "/api/ingest",
            &key,
            json!({"events":[event("valid",json!(1)),invalid]})
        )
        .await
        .0,
        StatusCode::BAD_REQUEST
    );
    let (_, r) = call(
        &f.app,
        "POST",
        &format!("/api/products/{id}/query"),
        MANAGEMENT,
        range(),
    )
    .await;
    assert_eq!(r["summary"]["total"], 0);
    let (_, keys) = call(
        &f.app,
        "GET",
        &format!("/api/products/{id}/keys"),
        MANAGEMENT,
        Value::Null,
    )
    .await;
    let kid = keys[0]["id"].as_str().unwrap();
    assert!(keys[0].get("hash").is_none());
    assert!(keys[0].get("key").is_none());
    let (other, _) = f.product("Other").await;
    assert_eq!(
        call(
            &f.app,
            "DELETE",
            &format!("/api/products/{other}/keys/{kid}"),
            MANAGEMENT,
            Value::Null
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        call(
            &f.app,
            "DELETE",
            &format!("/api/products/{id}/keys/{kid}"),
            MANAGEMENT,
            Value::Null
        )
        .await
        .0,
        StatusCode::NO_CONTENT
    );
    assert_eq!(
        call(&f.app, "POST", "/api/ingest", &key, event("a", json!(1)))
            .await
            .0,
        StatusCode::UNAUTHORIZED
    );
    f.state.writer.stop().await;
}
#[tokio::test]
async fn retention_is_product_specific_and_uses_event_time() {
    let f = Fixture::new(8);
    let (a, ka) = f.product("Short").await;
    let (b, kb) = f.product("Long").await;
    let mut old = event("old", json!(5));
    old["timestamp"] = json!((chrono::Utc::now() - chrono::Duration::days(3)).to_rfc3339());
    for key in [&ka, &kb] {
        assert_eq!(
            call(&f.app, "POST", "/api/ingest", key, old.clone())
                .await
                .0,
            StatusCode::OK
        );
    }
    call(
        &f.app,
        "PATCH",
        &format!("/api/products/{a}"),
        MANAGEMENT,
        json!({"name":"Short","retention_days":1}),
    )
    .await;
    let mut changes = f.state.changes.subscribe();
    let (_, r) = call(&f.app, "POST", "/api/cleanup", MANAGEMENT, Value::Null).await;
    assert_eq!(r["removed"], 1);
    assert_eq!(changes.recv().await.unwrap(), a);
    assert!(changes.try_recv().is_err());
    let (_, r) = call(&f.app, "POST", "/api/cleanup", MANAGEMENT, Value::Null).await;
    assert_eq!(r["removed"], 0);
    assert!(changes.try_recv().is_err());
    for (id, total) in [(&a, 0), (&b, 1)] {
        let (_, r) = call(
            &f.app,
            "POST",
            &format!("/api/products/{id}/query"),
            MANAGEMENT,
            range(),
        )
        .await;
        assert_eq!(r["summary"]["total"], total);
    }
    assert_eq!(
        call(&f.app, "POST", "/api/ingest", &ka, old).await.0,
        StatusCode::BAD_REQUEST
    );
    f.state.writer.stop().await;
}
#[tokio::test]
async fn concurrent_ingestion_queries_and_controlled_overload() {
    let f = Fixture::new(1);
    let (id, key) = f.product("Concurrency").await;
    let mut jobs = tokio::task::JoinSet::new();
    for i in 0..40 {
        let app = f.app.clone();
        let key = key.clone();
        jobs.spawn(async move {
            call(
                &app,
                "POST",
                "/api/ingest",
                &key,
                event(&format!("event-{i}"), json!(i)),
            )
            .await
            .0
        });
    }
    let mut accepted = 0;
    let mut overloaded = 0;
    while let Some(result) = jobs.join_next().await {
        match result.unwrap() {
            StatusCode::OK => accepted += 1,
            StatusCode::SERVICE_UNAVAILABLE => overloaded += 1,
            s => panic!("Unexpected {s}"),
        }
    }
    assert!(accepted > 0);
    assert!(overloaded > 0);
    let (_, r) = call(
        &f.app,
        "POST",
        &format!("/api/products/{id}/query"),
        MANAGEMENT,
        range(),
    )
    .await;
    assert_eq!(r["summary"]["total"], accepted);
    let held = f
        .state
        .store
        .query_slots
        .clone()
        .acquire_many_owned(2)
        .await
        .unwrap();
    assert_eq!(
        call(
            &f.app,
            "POST",
            &format!("/api/products/{id}/query"),
            MANAGEMENT,
            range()
        )
        .await
        .0,
        StatusCode::SERVICE_UNAVAILABLE
    );
    drop(held);
    let app = f.app.clone();
    let id2 = id.clone();
    let q = tokio::spawn(async move {
        call(
            &app,
            "POST",
            &format!("/api/products/{id2}/query"),
            MANAGEMENT,
            range(),
        )
        .await
        .0
    });
    assert_eq!(
        call(
            &f.app,
            "POST",
            "/api/ingest",
            &key,
            event("last", json!(12))
        )
        .await
        .0,
        StatusCode::OK
    );
    assert_eq!(q.await.unwrap(), StatusCode::OK);
    f.state.writer.stop().await;
}
#[tokio::test]
async fn visitor_and_installation_ids_do_not_collapse() {
    let f = Fixture::new(8);
    let (id, key) = f.product("Mixed").await;
    let mut web = event("web", json!(1));
    web["identity_kind"] = json!("visitor");
    web["source"] = json!("browser");
    web["session_id"] = json!("session");
    call(
        &f.app,
        "POST",
        "/api/ingest",
        &key,
        json!({"events":[web,event("cli",json!(2))]}),
    )
    .await;
    let (_, r) = call(
        &f.app,
        "POST",
        &format!("/api/products/{id}/query"),
        MANAGEMENT,
        range(),
    )
    .await;
    assert_eq!(r["summary"]["actors"], 2);
    assert_eq!(r["summary"]["sessions"], 1);
    f.state.writer.stop().await;
}

#[tokio::test]
async fn management_has_no_app_auth_but_rejects_cross_site_mutations() {
    let f = Fixture::new(8);
    let response = f
        .app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/products")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let response = f
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/products")
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({"name":"CSRF","retention_days":30}).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
    let response = f
        .app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/session")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    let (a, key) = f.product("Public ingestion").await;
    let response = f
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("OPTIONS")
                .uri("/api/ingest")
                .header("origin", "https://website.example")
                .header("access-control-request-method", "POST")
                .header(
                    "access-control-request-headers",
                    "authorization,content-type",
                )
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.headers()["access-control-allow-origin"], "*");
    let (_, result) = call(
        &f.app,
        "POST",
        "/api/ingest",
        &key,
        event("no-management-secret", json!(42)),
    )
    .await;
    assert_eq!(result["accepted"], 1);
    let (_, result) = call(
        &f.app,
        "POST",
        &format!("/api/products/{a}/query"),
        MANAGEMENT,
        range(),
    )
    .await;
    assert_eq!(result["summary"]["total"], 1);
    f.state.writer.stop().await;
}

#[tokio::test]
async fn committed_changes_are_visible_scoped_and_skip_duplicate_retries() {
    let f = Fixture::new(8);
    let (a, ka) = f.product("Changed A").await;
    let (b, kb) = f.product("Changed B").await;
    let mut changes = f.state.changes.subscribe();
    let app = f.app.clone();
    let retry_key = ka.clone();
    let request = tokio::spawn(async move {
        call(&app, "POST", "/api/ingest", &ka, event("one", json!(12))).await
    });
    assert_eq!(changes.recv().await.unwrap(), a);
    // Read as soon as the signal arrives, independently of the HTTP acknowledgment.
    let (_, result) = call(
        &f.app,
        "POST",
        &format!("/api/products/{a}/query"),
        MANAGEMENT,
        range(),
    )
    .await;
    assert_eq!(result["summary"]["total"], 1);
    let (status, ack) = request.await.unwrap();
    assert_eq!(status, StatusCode::OK);
    assert_eq!(ack["accepted"], 1);
    let (_, retry) = call(
        &f.app,
        "POST",
        "/api/ingest",
        &retry_key,
        event("one", json!(12)),
    )
    .await;
    assert_eq!(retry["duplicates"], 1);
    assert!(matches!(
        changes.try_recv(),
        Err(tokio::sync::broadcast::error::TryRecvError::Empty)
    ));
    let (_, ack) = call(&f.app, "POST", "/api/ingest", &kb, event("one", json!(24))).await;
    assert_eq!(ack["accepted"], 1);
    assert_eq!(changes.recv().await.unwrap(), b);
    let mut invalid = event("invalid", json!(12));
    invalid["properties"]["nested"] = json!({"invalid": true});
    assert_eq!(
        call(&f.app, "POST", "/api/ingest", &retry_key, invalid)
            .await
            .0,
        StatusCode::BAD_REQUEST
    );
    assert!(matches!(
        changes.try_recv(),
        Err(tokio::sync::broadcast::error::TryRecvError::Empty)
    ));
    f.state.writer.stop().await;
}

#[tokio::test]
async fn unavailable_change_sink_does_not_change_ingestion_acknowledgments() {
    use piko::changes::ChangeDelivery;
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let (tx, mut rx) = tokio::sync::mpsc::channel(4);
    let sink = Router::new().route(
        "/changes",
        axum::routing::post(move || {
            let tx = tx.clone();
            async move {
                let _ = tx.send(()).await;
                StatusCode::SERVICE_UNAVAILABLE
            }
        }),
    );
    let server = tokio::spawn(async move {
        axum::serve(listener, sink).await.unwrap();
    });
    let f = Fixture::new(8);
    let (id, key) = f.product("Unavailable notifications").await;
    let worker = f
        .state
        .changes
        .start_delivery(
            ChangeDelivery::new(
                &format!("http://{address}/changes"),
                "test-only-token".into(),
            )
            .unwrap(),
        )
        .unwrap();
    rx.recv().await.unwrap();
    let (status, ack) = call(
        &f.app,
        "POST",
        "/api/ingest",
        &key,
        event("committed", json!(42)),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(ack["accepted"], 1);
    let (_, result) = call(
        &f.app,
        "POST",
        &format!("/api/products/{id}/query"),
        MANAGEMENT,
        range(),
    )
    .await;
    assert_eq!(result["summary"]["total"], 1);
    worker.abort();
    server.abort();
    f.state.writer.stop().await;
}

#[tokio::test]
async fn multiple_sources_share_a_project_but_keys_and_filters_are_scoped() {
    let f = Fixture::new(8);
    let (id, original_key) = f.product("Multi-source").await;
    let (_, mobile) = call(
        &f.app,
        "POST",
        &format!("/api/products/{id}/sources"),
        MANAGEMENT,
        json!({"name":"iOS"}),
    )
    .await;
    assert_eq!(
        call(
            &f.app,
            "POST",
            &format!("/api/products/{id}/sources"),
            MANAGEMENT,
            json!({"name":"IOS"})
        )
        .await
        .0,
        StatusCode::BAD_REQUEST
    );
    assert!(mobile["icon"].is_null());
    assert!(mobile.get("kind").is_none());
    assert_eq!(
        call(
            &f.app,
            "POST",
            &format!("/api/products/{id}/sources"),
            MANAGEMENT,
            json!({"name":"Invalid", "icon":"unrecognized"})
        )
        .await
        .0,
        StatusCode::BAD_REQUEST
    );
    assert_eq!(
        call(
            &f.app,
            "POST",
            &format!("/api/products/{id}/sources"),
            MANAGEMENT,
            json!({"name":"Old type", "kind":"mobile"})
        )
        .await
        .0,
        StatusCode::UNPROCESSABLE_ENTITY
    );
    let source_id = mobile["id"].as_str().unwrap();
    let (_, key) = call(
        &f.app,
        "POST",
        &format!("/api/products/{id}/keys"),
        MANAGEMENT,
        json!({"label":"iOS production","source_id":source_id}),
    )
    .await;
    let mobile_key = key["key"].as_str().unwrap();
    assert_eq!(key["source_id"], source_id);
    for (token, event_id, value) in [(&*original_key, "cli-1", 10), (mobile_key, "mobile-1", 20)] {
        let (status, ack) = call(
            &f.app,
            "POST",
            "/api/ingest",
            token,
            event(event_id, json!(value)),
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(ack["accepted"], 1);
    }
    let (_, retry) = call(
        &f.app,
        "POST",
        "/api/ingest",
        mobile_key,
        event("cli-1", json!(999)),
    )
    .await;
    assert_eq!(retry["duplicates"], 1); // IDs remain project-scoped across sources and key rotation.
    let mut q = range();
    q["measure"] = json!("sum");
    q["property"] = json!("duration_ms");
    q["group_by"] = json!("source_id");
    let (_, all) = call(
        &f.app,
        "POST",
        &format!("/api/products/{id}/query"),
        MANAGEMENT,
        q.clone(),
    )
    .await;
    assert_eq!(all["summary"]["total"], 2);
    assert_eq!(all["summary"]["value"], 30.0);
    assert_eq!(all["groups"].as_array().unwrap().len(), 2);
    q["source_id"] = json!(source_id);
    let (_, filtered) = call(
        &f.app,
        "POST",
        &format!("/api/products/{id}/query"),
        MANAGEMENT,
        q.clone(),
    )
    .await;
    assert_eq!(filtered["summary"]["total"], 1);
    assert_eq!(filtered["summary"]["value"], 20.0);
    assert_eq!(filtered["events"][0]["source_id"], source_id);
    assert_eq!(filtered["events"][0]["source"], "cli"); // Client hint cannot change the key's source.
    let mut spoofed = event("spoofed", json!(1));
    spoofed["source_id"] = json!(id);
    assert_eq!(
        call(&f.app, "POST", "/api/ingest", mobile_key, spoofed)
            .await
            .0,
        StatusCode::UNPROCESSABLE_ENTITY
    );
    let (other, _) = f.product("Other project").await;
    assert_eq!(
        call(
            &f.app,
            "POST",
            &format!("/api/products/{other}/keys"),
            MANAGEMENT,
            json!({"label":"wrong","source_id":source_id})
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        call(
            &f.app,
            "POST",
            &format!("/api/products/{other}/query"),
            MANAGEMENT,
            q.clone()
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    let (status, renamed) = call(
        &f.app,
        "PATCH",
        &format!("/api/products/{id}/sources/{source_id}"),
        MANAGEMENT,
        json!({"name":"iOS app", "icon":"android"}),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(renamed["id"], source_id);
    assert_eq!(renamed["icon"], "android");
    let (_, filtered) = call(
        &f.app,
        "POST",
        &format!("/api/products/{id}/query"),
        MANAGEMENT,
        q,
    )
    .await;
    assert_eq!(filtered["summary"]["value"], 20.0);
    assert_eq!(
        call(
            &f.app,
            "DELETE",
            &format!("/api/products/{id}/keys/{}", key["id"].as_str().unwrap()),
            MANAGEMENT,
            json!(null)
        )
        .await
        .0,
        StatusCode::NO_CONTENT
    );
    assert_eq!(
        call(
            &f.app,
            "POST",
            "/api/ingest",
            mobile_key,
            event("revoked-source", json!(1))
        )
        .await
        .0,
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(
        call(
            &f.app,
            "POST",
            "/api/ingest",
            &original_key,
            event("still-active", json!(1))
        )
        .await
        .0,
        StatusCode::OK
    );
    f.state.writer.stop().await;
}

#[tokio::test]
async fn existing_keys_and_events_migrate_to_the_initial_source_without_changing_counts() {
    let dir = tempfile::tempdir().unwrap();
    let id = uuid::Uuid::new_v4().to_string();
    let key = "pk_existing_key";
    let sql = rusqlite::Connection::open(dir.path().join("state.sqlite")).unwrap();
    sql.execute_batch("CREATE TABLE products(id TEXT PRIMARY KEY,name TEXT NOT NULL,kind TEXT NOT NULL,retention_days INTEGER NOT NULL,created_at TEXT NOT NULL);
        CREATE TABLE ingestion_keys(id TEXT PRIMARY KEY,product_id TEXT NOT NULL,label TEXT NOT NULL,prefix TEXT NOT NULL,hash TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL,revoked INTEGER NOT NULL DEFAULT 0);").unwrap();
    sql.execute(
        "INSERT INTO products VALUES (?,'Legacy','website',30,'2026-01-01')",
        [&id],
    )
    .unwrap();
    sql.execute(
        "INSERT INTO ingestion_keys VALUES ('key',?,'Existing','pk_existing',?,'2026-01-01',0)",
        rusqlite::params![id, piko::store::hash(key)],
    )
    .unwrap();
    drop(sql);
    std::fs::create_dir_all(dir.path().join("products")).unwrap();
    let db =
        duckdb::Connection::open(dir.path().join("products").join(format!("{id}.duckdb"))).unwrap();
    db.execute_batch("CREATE TABLE events(product_id VARCHAR NOT NULL,event_id VARCHAR NOT NULL,name VARCHAR NOT NULL,source VARCHAR NOT NULL,event_time BIGINT NOT NULL,received_at BIGINT NOT NULL,actor_id VARCHAR,identity_kind VARCHAR,session_id VARCHAR,properties JSON NOT NULL,PRIMARY KEY(product_id,event_id));").unwrap();
    db.execute("INSERT INTO events VALUES (?,'old','page_view','browser',?,?,NULL,NULL,NULL,'{\"duration_ms\":12}')",duckdb::params![id,chrono::Utc::now().timestamp_millis(),chrono::Utc::now().timestamp_millis()]).unwrap();
    drop(db);
    for _ in 0..2 {
        let state = AppState::open(&config(dir.path(), 8)).unwrap();
        let app = router(state.clone());
        let (_, products) = call(&app, "GET", "/api/products", MANAGEMENT, json!(null)).await;
        assert_eq!(products[0]["sources"][0]["id"], id);
        assert_eq!(products[0]["sources"].as_array().unwrap().len(), 1);
        let mut q = range();
        q["source_id"] = json!(id);
        let (_, result) = call(
            &app,
            "POST",
            &format!("/api/products/{id}/query"),
            MANAGEMENT,
            q,
        )
        .await;
        assert_eq!(result["summary"]["total"], 1);
        assert_eq!(result["events"][0]["source_id"], id);
        let (_, ack) = call(&app, "POST", "/api/ingest", key, event("old", json!(99))).await;
        assert_eq!(ack["duplicates"], 1);
        state.writer.stop().await;
        drop(app);
        drop(state);
    }
}

#[tokio::test]
async fn origin_restrictions_are_enforced_before_writing_and_persist() {
    let f = Fixture::new(16);
    let (id, native) = f.product("Restricted site").await;
    let (other, _) = f.product("Other project").await;
    let path = format!("/api/products/{id}/keys");
    let (status, created) = call(&f.app, "POST", &path, "", json!({"label":"Browser","allowed_origins":["https://EXAMPLE.com:443/","https://*.example.com"]})).await;
    assert_eq!(status, StatusCode::OK, "{created}");
    let key = created["key"].as_str().unwrap();
    let key_id = created["id"].as_str().unwrap();
    assert_eq!(created["allowed_origins"][0], "https://example.com");
    async fn send(app: &Router, key: &str, origin: Option<&str>) -> StatusCode {
        let mut request = Request::builder()
            .method("POST")
            .uri("/api/ingest")
            .header("authorization", format!("Bearer {key}"))
            .header("content-type", "application/json");
        if let Some(origin) = origin {
            request = request.header("origin", origin);
        }
        app.clone()
            .oneshot(
                request
                    .body(Body::from(event("same-retry-id", json!(12)).to_string()))
                    .unwrap(),
            )
            .await
            .unwrap()
            .status()
    }
    for origin in [
        None,
        Some("null"),
        Some("https://evilexample.com"),
        Some("https://example.com.evil.test"),
        Some("http://app.example.com"),
        Some("https://app.example.com:444"),
    ] {
        assert_eq!(send(&f.app, key, origin).await, StatusCode::FORBIDDEN);
    }
    let (_, empty) = call(
        &f.app,
        "POST",
        &format!("/api/products/{id}/query"),
        "",
        range(),
    )
    .await;
    assert_eq!(empty["summary"]["total"], 0);
    for origin in ["https://example.com", "https://app.example.com"] {
        assert_eq!(send(&f.app, key, Some(origin)).await, StatusCode::OK);
    }
    assert_eq!(send(&f.app, &native, None).await, StatusCode::OK);
    let (status, _) = call(
        &f.app,
        "PATCH",
        &format!("/api/products/{other}/keys/{key_id}"),
        "",
        json!({"allowed_origins":[]}),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (_, invalid) = call(
        &f.app,
        "POST",
        &path,
        "",
        json!({"label":"bad","allowed_origins":["*"]}),
    )
    .await;
    assert!(invalid["error"].is_string());
    f.state.writer.stop().await;
    let restarted = AppState::open(&config(f.dir.path(), 16)).unwrap();
    let app = router(restarted.clone());
    assert_eq!(send(&app, key, None).await, StatusCode::FORBIDDEN);
    let (_, keys) = call(&app, "GET", &path, "", Value::Null).await;
    assert!(
        keys.as_array()
            .unwrap()
            .iter()
            .any(|k| k["id"] == key_id && k["allowed_origins"].as_array().unwrap().len() == 2)
    );
    let (status, _) = call(
        &app,
        "PATCH",
        &format!("{path}/{key_id}"),
        "",
        json!({"allowed_origins":[]}),
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(send(&app, key, None).await, StatusCode::OK);
    let (_, result) = call(
        &app,
        "POST",
        &format!("/api/products/{id}/query"),
        "",
        range(),
    )
    .await;
    assert_eq!(result["summary"]["total"], 1);
    restarted.writer.stop().await;
}
