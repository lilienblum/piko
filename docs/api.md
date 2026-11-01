# API and semantics

The dashboard talks to this API over HTTP; the API does not serve frontend files. There is no application login, admin token, or admin session. Protect management access with Cloudflare Access and keep the origin private; see [access configuration](access.md). Ingestion still requires a source-scoped write-only ingestion key. Its key resolves the target project and source; its events go to `products/<product-id>.duckdb`. SQLite holds the shared project/source/key catalog and settings. The public API keeps its existing `/products` paths and `product_id` fields; “project” is the interface name for the same entity.

## Management

| Method     | Path                            | Body/result                                                         |
| ---------- | ------------------------------- | ------------------------------------------------------------------- |
| GET / POST | `/api/products`                 | List / create `{ name, retention_days }`                            |
| PATCH      | `/api/products/:id`             | Edit name and retention (1–3650 days)                               |
| GET / POST | `/api/products/:id/keys`        | List metadata / create `{ label, source_id }` → full key shown once |
| DELETE     | `/api/products/:id/keys/:keyId` | Revoke key, scoped to product                                       |
| POST       | `/api/products/:id/query`       | Parameterized analytics query below                                 |
| POST       | `/api/cleanup`                  | Run the same retention cleanup as the hourly job                    |
| GET        | `/health`                       | Process health, no credentials required                             |

Management mutations require `X-Piko-Admin: 1`. This public request marker prevents cross-site form submissions; it is **not authentication**. The API grants no management CORS access. Network access to management must be controlled by Cloudflare Access (or a trusted private network). Ingestion keys grant no bypass through Access and are never used as management credentials.

## Projects and sources

A project owns one DuckDB database, shared retention, and any number of sources. A source is a named integration such as Website, iOS app, or CLI. All sources have the same analytics capabilities; there is no project or source type. Source names are unique within a project (ASCII case-insensitive). Creating a project automatically creates an initial source named **Events**, which can be renamed. Project responses include `sources` with `id`, `product_id`, `name`, `icon`, and `created_at`.

- `GET /api/products/:id/sources`: list sources.
- `POST /api/products/:id/sources` with `{ "name": "iOS app" }`: create a source with an automatic icon.
- `PATCH /api/products/:id/sources/:sourceId` with `{ "name": "iOS app", "icon": "ios" }`: save a name and optional icon without changing its ID or historical attribution. As with the existing edit endpoint, send the complete editable representation; an omitted or null icon selects Automatic.
- `POST /api/products/:id/keys` with `{ "label": "iOS release", "source_id": "SOURCE_UUID" }`: create a write-only key for that source. Omitting `source_id` selects the initial source. Key metadata and creation responses include `source_id`.

`icon` accepts `website`, `ios`, `android`, `mobile`, `terminal`, `desktop`, `server`, `code`, `package`, `game`, or `generic`. An omitted/null value is stored as null: the dashboard derives a visual icon from common platform words in the current name, with a cube fallback. Explicit choices stay fixed across renames. Icons never filter events, select metrics or integration languages, or infer user/device identity. Unknown icons return 400; obsolete `kind` fields are rejected with 422.

Keys cannot move between sources or projects. Foreign-project source IDs are rejected. Source deletion and merging are not supported; revoke a source's keys to stop new authorized intake.

### Existing data

Stop the API and back up the whole data directory before updating. Catalog schema 3 adds nullable `sources.icon` and removes the obsolete `kind` columns from projects and sources. Existing sources use Automatic, retaining their names, IDs, creation times and key assignments. The migration does not rewrite analytics events. Repeated startup preserves subsequent icon choices.

For catalogs predating Sources, migration first creates one initial source per project and assigns its existing keys. Each older DuckDB file receives an additive `source_id` column when opened; historical events belong to that initial source. Attribution is never guessed from the free-form event `source` label. Counts, event IDs, and key values remain unchanged. Older API binaries cannot use the new catalog; downgrading requires restoring the complete pre-upgrade backup. Management clients must stop sending `kind`; ingestion SDKs are unchanged.

## Ingestion

```sh
curl http://localhost:3001/api/ingest \
  -H 'Authorization: Bearer pk_YOUR_WRITE_ONLY_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "event_id": "3529a1c5-46e9-4143-b0d7-3ad2fbb2fb0e",
    "name": "command_run",
    "source": "cli",
    "timestamp": "2026-11-01T02:00:00Z",
    "actor_id": "random-installation-id",
    "identity_kind": "installation",
    "properties": {
      "command": "build", "version": "1.4.2", "os": "linux", "arch": "x86_64",
      "success": true, "duration_ms": 142
    }
  }'
```

Send one envelope or `{ "events": [ ... ] }` with 1–100 envelopes. The body limit is 256 KiB. `event_id`, `name`, and `source` are required strings of 1–64 ASCII letters/digits or `_ - . /`. Unknown envelope fields (including `product_id`, `source_id`, and `received_at`) are rejected. The key alone authorizes and resolves the project and managed source. The envelope `source` remains a free-form client/transport label (for example `browser`, `ios`, or `cli`); the dashboard calls it **Client**. It cannot choose or override the managed source.

- `timestamp`: optional RFC3339; normalized to UTC. Omitted timestamps use receipt time. A time older than product retention or >5 minutes in the future is rejected.
- `actor_id`: optional 1–128 byte opaque ID. Requires `identity_kind` (`visitor`, `installation`, or `actor`), and vice versa. Distinct counts namespace actors by product and identity kind.
- `session_id`: optional 1–128 byte ID, allowed only for visitor identity. Sessions count distinct `(actor_id, session_id)` pairs within the selected range, not globally completed sessions.
- `properties`: up to 32 flat entries. Values must be strings (≤2048 bytes), JSON numbers, or booleans. Arrays, objects, and null are rejected. Keys use the same character rules as event names. Numeric-looking strings stay strings and are excluded from numeric measures.
- `received_at`: set by the server. Both timestamps are stored as integer UTC milliseconds; queries filter by event time.

Successful response: **200 `{ "accepted": 2, "duplicates": 1 }`**, only after DuckDB commits. One invalid event rejects the whole HTTP batch. Duplicate `(product_id, event_id)` values use the **first committed payload** and never overwrite it. Duplicates within the same queued transaction also use first occurrence. Two projects may reuse the same event ID independently. Sources within one project share the deduplication namespace: use globally unique event IDs, including across source keys.

On network failure, timeout, or 5xx/429, retry **the exact same IDs and timestamps**, using capped backoff and `Retry-After`. Do not regenerate IDs. A 503 after the acknowledgment deadline may mean the write committed later; retrying resolves this ambiguity safely. Invalid payloads return 400/422 (or 413 for oversized bodies); invalid/revoked keys return 401. Do not retry these unchanged. No dedup tombstone remains after retention deletes an event. Explicit old timestamps are rejected, but a new current timestamp with an expired ID can count again.

Key authorization and retention validation occur at request acceptance. Revocation rejects subsequent authorizations; already-authorized in-flight requests may finish. Retention changes apply at the next cleanup. Ingestion is deliberately CORS-enabled without cookies; management is not.

## Query

```json
{
  "from": "2026-10-01T00:00:00Z",
  "to": "2026-11-01T00:00:00Z",
  "bucket": "day",
  "event": "command_run",
  "source": "cli",
  "identity_kind": "installation",
  "measure": "avg",
  "property": "duration_ms",
  "group_by": "property:command",
  "filters": [{ "property": "success", "op": "eq", "value": true }],
  "page": 0,
  "page_size": 25
}
```

Ranges are **[from, to)**, UTC. Day/hour buckets align to UTC epoch boundaries and include partial edge buckets. Missing count/actor/sum buckets are zero; average/percentile buckets are null. `avg`, `sum`, `p50`, and `p95` require a property and include only JSON numeric values. Empty aggregate averages/sums/percentiles are null. Percentiles use DuckDB's continuous interpolation. Success rate includes only boolean `success` values. Overview duration includes numeric `duration_ms` only. Unknown identities do not count as a distinct actor.

Measures: `count`, `actors`, `sum`, `avg`, `p50`, `p95`. Group by `name`, `source_id` (managed source), `source` (client label), `identity_kind`, or `property:<key>`. Numeric and boolean group labels retain their JSON types. Filters use `eq`, `ne`, `gt`, `gte`, `lt`, `lte`; ordered comparisons require numeric filter values and numeric properties. Missing properties do not satisfy comparisons, including `ne`. Strings and booleans are type-sensitive.

Set optional `source_id` to a source in the requested project to scope summary, series, groups, event rows, and event-name discovery; omit it for the combined view. A foreign or missing source returns 404. Event rows include server-assigned `source_id`. Source-group labels are stable IDs; resolve names from the project catalog. Identity is still explicit and project-scoped by identity kind; sources do not automatically link people across apps.

Response includes `summary`, zero-filled `series`, top-12 `groups`, paginated `events`, and `event_names`. All components run against one transaction snapshot. JSON values are bound; identifiers and operations are validated. No arbitrary SQL is accepted.

## Resource model

A dedicated writer thread groups requests by product and drains up to 16 requests over an 8 ms window, appends typed rows into temporary DuckDB staging, deduplicates, and commits one set-based insert. Both the queue and concurrent ingestion body-processing slots default to 64. Envelopes are capped at 100 per request. Queue/body capacity exhaustion returns 503 with `Retry-After: 1`. The dashboard gateway also admits at most 64 pending ingestion uploads per process, with a 13-second total upload/upstream deadline. Oversized uploads return 413; gateway overload returns 503 with `Retry-After: 1` and ingestion CORS headers.

Up to four query connections are globally admitted by a semaphore, each cloned from the selected product’s DuckDB instance. At most eight product instances are cached; the least recently used inactive instance is closed when opening another. Active query/writer leases prevent eviction. If all eight are pinned, opening another returns 503. Queries run in `spawn_blocking`; the permit stays held until the actual query finishes even if the client disconnects. SQLite operations also run in bounded `spawn_blocking` tasks, using independent WAL connections and a 2-second busy timeout. Each product instance uses two execution threads and a 64 MB buffer memory limit; total process RSS can exceed this limit because not every allocation is tracked by DuckDB. Query admission fails fast with 503. There is no unbounded wait queue for queries.

Retention runs at startup and hourly, serialized through the writer. It deletes `event_time < now - retention_days` independently for each product. SIGINT/SIGTERM stop accepting HTTP work, finish accepted requests, drain the writer, and checkpoint the open product databases. Each product transaction commits independently; there are no cross-product write transactions.
