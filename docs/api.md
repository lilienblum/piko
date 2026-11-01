# API and semantics

The dashboard talks to this API over HTTP; the API does not serve frontend files. All management endpoints require `Authorization: Bearer <PIKO_ADMIN_TOKEN>` or an authenticated browser session. Ingestion requires a separate product-scoped ingestion key. Neither credential can be substituted for the other.

## Management

| Method       | Path                            | Body/result                                                                 |
| ------------ | ------------------------------- | --------------------------------------------------------------------------- |
| POST         | `/api/login`                    | `{ "token": "admin secret" }` → HttpOnly SameSite=Strict cookie, 24h expiry |
| GET / DELETE | `/api/session`                  | Check / revoke current session                                              |
| GET / POST   | `/api/products`                 | List / create `{ name, kind, retention_days }`                              |
| PATCH        | `/api/products/:id`             | Edit name, kind, and retention (1–3650 days)                                |
| GET / POST   | `/api/products/:id/keys`        | List metadata / create `{ label }` → full key shown once                    |
| DELETE       | `/api/products/:id/keys/:keyId` | Revoke key, scoped to product                                               |
| POST         | `/api/products/:id/query`       | Parameterized analytics query below                                         |
| POST         | `/api/cleanup`                  | Run the same retention cleanup as the hourly job                            |
| GET          | `/health`                       | Process health, no credentials required                                     |

Cookie-authenticated mutations need `X-Piko-Admin: 1`; the API does not grant management CORS access. Login attempts are globally limited to 20/minute. Use a high-entropy random admin token. Sessions are hashed in SQLite and survive restarts until logout or expiry. Rotating the environment token does not revoke existing sessions; to revoke all sessions, stop the API and delete session rows from SQLite before restarting.

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

Send one envelope or `{ "events": [ ... ] }` with 1–100 envelopes. The body limit is 256 KiB. `event_id`, `name`, and `source` are required strings of 1–64 ASCII letters/digits or `_ - . /`. Unknown envelope fields (including `product_id` and `received_at`) are rejected. The key alone authorizes and resolves the product. The source is a label, not the product type.

- `timestamp`: optional RFC3339; normalized to UTC. Omitted timestamps use receipt time. A time older than product retention or >5 minutes in the future is rejected.
- `actor_id`: optional 1–128 byte opaque ID. Requires `identity_kind` (`visitor`, `installation`, or `actor`), and vice versa. Distinct counts namespace actors by product and identity kind.
- `session_id`: optional 1–128 byte ID, allowed only for visitor identity. Sessions count distinct `(actor_id, session_id)` pairs within the selected range, not globally completed sessions.
- `properties`: up to 32 flat entries. Values must be strings (≤2048 bytes), JSON numbers, or booleans. Arrays, objects, and null are rejected. Keys use the same character rules as event names. Numeric-looking strings stay strings and are excluded from numeric measures.
- `received_at`: set by the server. Both timestamps are stored as integer UTC milliseconds; queries filter by event time.

Successful response: **200 `{ "accepted": 2, "duplicates": 1 }`**, only after DuckDB commits. One invalid event rejects the whole HTTP batch. Duplicate `(product_id, event_id)` values use the **first committed payload** and never overwrite it. Duplicates within the same queued transaction also use first occurrence. Two products may reuse the same event ID independently.

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

Measures: `count`, `actors`, `sum`, `avg`, `p50`, `p95`. Group by `name`, `source`, `identity_kind`, or `property:<key>`. Numeric and boolean group labels retain their JSON types. Filters use `eq`, `ne`, `gt`, `gte`, `lt`, `lte`; ordered comparisons require numeric filter values and numeric properties. Missing properties do not satisfy comparisons, including `ne`. Strings and booleans are type-sensitive.

Response includes `summary`, zero-filled `series`, top-12 `groups`, paginated `events`, and `event_names`. All components run against one transaction snapshot. JSON values are bound; identifiers and operations are validated. No arbitrary SQL is accepted.

## Resource model

A dedicated writer thread drains up to 16 requests over an 8 ms window, appends typed rows into temporary DuckDB staging, deduplicates, and commits one set-based insert. Both the queue and concurrent ingestion body-processing slots default to 64. Envelopes are capped at 100 per request. Queue/body capacity exhaustion returns 503 with `Retry-After: 1`.

Four independent cloned DuckDB query connections are guarded by a semaphore. Queries run in `spawn_blocking`; the permit stays held until the actual query finishes even if the client disconnects. SQLite operations also run in bounded `spawn_blocking` tasks, using independent WAL connections and a 2-second busy timeout. DuckDB uses two execution threads and a 512 MB buffer memory limit; total process RSS can exceed this limit because not every allocation is tracked by DuckDB. Query admission fails fast with 503. There is no unbounded wait queue for queries.

Retention runs at startup and hourly, serialized through the writer. It deletes `event_time < now - retention_days` independently for each product. It also removes expired admin sessions. SIGINT/SIGTERM stop accepting HTTP work, finish accepted requests, drain the writer, and checkpoint DuckDB.
