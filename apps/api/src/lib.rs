pub mod changes;
pub mod error;
pub mod ingest;
pub mod model;
pub mod product_db;
pub mod query;
pub mod runtime;
pub mod store;
pub mod telemetry;
use crate::{
    error::{ApiError, ApiResult},
    ingest::Writer,
    model::{IngestPayload, Product, ProductInput},
    store::Store,
};
use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, Path, Request, State},
    http::{HeaderMap, StatusCode, header},
    middleware::{self, Next},
    response::Response,
    routing::{delete, get, patch, post},
};
use serde::Deserialize;
use serde_json::{Value, json};
use std::{path::PathBuf, sync::Arc, time::Duration};
use tower_http::cors::{Any, CorsLayer};

#[derive(Clone)]
pub struct AppState {
    pub store: Arc<Store>,
    pub writer: Writer,
    pub changes: changes::Changes,
    ingest_slots: Arc<tokio::sync::Semaphore>,
}
pub struct Config {
    pub data_dir: PathBuf,
    pub query_concurrency: usize,
    pub queue_capacity: usize,
}
impl AppState {
    pub fn open(config: &Config) -> anyhow::Result<Self> {
        anyhow::ensure!(
            (1..=16).contains(&config.query_concurrency)
                && (1..=1024).contains(&config.queue_capacity),
            "query concurrency must be 1–16 and queue capacity 1–1024"
        );
        let store = Store::open(&config.data_dir, config.query_concurrency)?;
        let writer = Writer::start(store.clone(), config.queue_capacity);
        Ok(Self {
            changes: store.changes.clone(),
            store,
            writer,
            ingest_slots: Arc::new(tokio::sync::Semaphore::new(config.queue_capacity)),
        })
    }
}
pub fn router(state: AppState) -> Router {
    let admin = Router::new()
        .route("/api/products", get(list_products).post(create_product))
        .route("/api/products/{id}", patch(update_product))
        .route("/api/products/{id}/keys", get(list_keys).post(create_key))
        .route("/api/products/{id}/keys/{key}", delete(revoke_key))
        .route("/api/products/{id}/query", post(query_product))
        .route("/api/cleanup", post(run_cleanup))
        .route_layer(middleware::from_fn(management_request));
    let ingest = Router::new()
        .route("/api/ingest", post(ingest_events))
        .layer(middleware::from_fn_with_state(state.clone(), ingest_limit))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods([axum::http::Method::POST])
                .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION]),
        );
    Router::new()
        .merge(admin)
        .merge(ingest)
        .route("/api/{*path}", get(|| async { ApiError::missing() }))
        .route("/health", get(|| async { Json(json!({"status":"ok"})) }))
        .layer(DefaultBodyLimit::max(256 * 1024))
        .layer(middleware::from_fn(security_headers))
        .with_state(state)
}
async fn security_headers(req: Request, next: Next) -> Response {
    let mut response = next.run(req).await;
    for (k, v) in [
        ("x-content-type-options", "nosniff"),
        ("x-frame-options", "DENY"),
        ("referrer-policy", "no-referrer"),
        ("cache-control", "no-store"),
    ] {
        response.headers_mut().insert(
            axum::http::HeaderName::from_static(k),
            v.parse().expect("static header"),
        );
    }
    response
}
fn bearer(headers: &HeaderMap) -> Option<&str> {
    headers
        .get(header::AUTHORIZATION)?
        .to_str()
        .ok()?
        .strip_prefix("Bearer ")
}
// This is a CSRF request marker, not authentication. Network/edge access controls are required.
async fn management_request(req: Request, next: Next) -> ApiResult<Response> {
    if req.method() != axum::http::Method::GET
        && req
            .headers()
            .get("x-piko-admin")
            .and_then(|v| v.to_str().ok())
            != Some("1")
    {
        return Err(ApiError(
            StatusCode::FORBIDDEN,
            "Management requests require X-Piko-Admin: 1".into(),
        ));
    }
    Ok(next.run(req).await)
}
async fn ingest_limit(
    State(state): State<AppState>,
    req: Request,
    next: Next,
) -> ApiResult<Response> {
    let _permit = state
        .ingest_slots
        .try_acquire()
        .map_err(|_| ApiError::busy())?;
    tokio::time::timeout(Duration::from_secs(12), next.run(req))
        .await
        .map_err(|_| ApiError::busy())
}
async fn ingest_events(
    State(state): State<AppState>,
    headers: HeaderMap,
    payload: Result<Json<IngestPayload>, axum::extract::rejection::JsonRejection>,
) -> ApiResult<Json<model::Ack>> {
    let key = bearer(&headers)
        .ok_or_else(ApiError::unauthorized)?
        .to_string();
    let p = state
        .store
        .state(move |db| store::resolve_key(db, &key))
        .await?;
    let Json(payload) = payload.map_err(|e| ApiError(e.status(), e.body_text()))?;
    let mut events = payload.events();
    if events.is_empty() || events.len() > 100 {
        return Err(ApiError::bad("Provide 1–100 events per request"));
    }
    let now = chrono::Utc::now();
    for (i, event) in events.iter_mut().enumerate() {
        event
            .validate(now, p.retention_days)
            .map_err(|e| ApiError::bad(format!("events[{i}]: {}", e.1)))?;
    }
    Ok(Json(state.writer.ingest(p.id, events).await?))
}
async fn list_products(State(s): State<AppState>) -> ApiResult<Json<Vec<Product>>> {
    Ok(Json(s.store.state(store::products).await?))
}
async fn create_product(
    State(s): State<AppState>,
    Json(input): Json<ProductInput>,
) -> ApiResult<Json<Product>> {
    Ok(Json(
        s.store
            .state(move |db| store::save_product(db, None, input))
            .await?,
    ))
}
async fn update_product(
    State(s): State<AppState>,
    Path(id): Path<String>,
    Json(input): Json<ProductInput>,
) -> ApiResult<Json<Product>> {
    Ok(Json(
        s.store
            .state(move |db| store::save_product(db, Some(id), input))
            .await?,
    ))
}
async fn list_keys(
    State(s): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<Json<Vec<model::KeyInfo>>> {
    Ok(Json(s.store.state(move |db| store::keys(db, &id)).await?))
}
#[derive(Deserialize)]
struct NewKey {
    label: String,
}
async fn create_key(
    State(s): State<AppState>,
    Path(id): Path<String>,
    Json(input): Json<NewKey>,
) -> ApiResult<Json<Value>> {
    Ok(Json(
        s.store
            .state(move |db| store::create_key(db, &id, &input.label))
            .await?,
    ))
}
async fn revoke_key(
    State(s): State<AppState>,
    Path((id, key)): Path<(String, String)>,
) -> ApiResult<StatusCode> {
    s.store
        .state(move |db| {
            let n = db
                .execute(
                    "UPDATE ingestion_keys SET revoked=1 WHERE product_id=? AND id=?",
                    [id, key],
                )
                .map_err(anyhow::Error::from)?;
            if n == 0 {
                return Err(ApiError::missing());
            }
            Ok(())
        })
        .await?;
    Ok(StatusCode::NO_CONTENT)
}
async fn query_product(
    State(s): State<AppState>,
    Path(id): Path<String>,
    Json(q): Json<query::Query>,
) -> ApiResult<Json<Value>> {
    q.validate()?;
    let lookup = id.clone();
    s.store.state(move |db| store::product(db, &lookup)).await?;
    Ok(Json(
        s.store
            .query(id.clone(), move |db| query::run(db, &id, q))
            .await?,
    ))
}
async fn run_cleanup(State(s): State<AppState>) -> ApiResult<Json<Value>> {
    Ok(Json(json!({"removed":s.writer.cleanup().await?})))
}
