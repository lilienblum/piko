# Two Tako applications

Piko uses the published Rust SDK for the API and the JavaScript SDK for TanStack Start. Tako itself is unchanged. The API has no dashboard imports: it can optionally emit generic post-commit change hints to a configured HTTP endpoint. The dashboard turns those hints into a durable Tako channel.

## Local development

```sh
bun install --frozen-lockfile
bun dev
SSL_CERT_FILE=.tako/dev-ca.pem PIKO_API_URL=https://piko-api.test bun seed
# Stop only these two apps:
bun run dev:stop
```

The root configs select independent app identities and hosts: `tako.api.toml` is `piko-api` at `https://piko-api.test`; `tako.dashboard.toml` is `piko` at `https://piko.test`. The dashboard's same-origin `/api/*` route forwards requests to the API. The returned Tako HTTPS URLs are the supported development entrypoints. The runner links the public local Tako CA at `.tako/dev-ca.pem`; development-only `SSL_CERT_FILE` settings let Bun and Rust verify it even when their default trust stores differ from macOS. Certificate verification stays enabled.

The development runner creates a random shared `PIKO_CHANGE_TOKEN` through the CLI's stdin interface if absent. Both configs share the repository's encrypted `.tako/secrets.json`. Never commit that directory or print the secret. Runtime code obtains it from SDK secrets, not browser environment variables. A token rotation requires restarting both apps.

The API stores its catalog and product databases under `$TAKO_DATA_DIR`, locally `.tako/data/app`. Only the API uses those files. Existing standalone data can be migrated by stopping every API process and copying the **entire** `data/` directory to an empty managed data directory. Preserve the original until counts and retry behavior have been checked. Never copy active DuckDB/WAL files or start old and new binaries against the same directory.

`bun run dev:standalone` retains the localhost development mode. The compiled standalone server remains supported by Docker Compose. Those modes have manual refresh and no channel connection.

## Realtime semantics

1. Rust validates and batches ingestion, commits the product DuckDB transaction, and acknowledges successful persistence. Dedup-only retries emit no change hint.
2. A bounded broadcast buffer holds up to 128 product hints. A background worker coalesces them over 250 ms, with at most 64 product IDs per message. Overflow becomes a global resync hint. Retention emits only after a deletion commits.
3. The API POSTs `{ "version": 1, "products": ["product-uuid"] }` to `PIKO_CHANGE_URL`, using the shared bearer secret. `products: null` means resync all products. Each attempt has an 800 ms deadline; failures retry a global hint with backoff capped at 30 seconds. Startup emits a global hint. Delivery never delays ingestion acknowledgments.
4. `POST /_piko/changes` validates the secret, content type, an 8 KiB body limit, UUIDs, and the version. It publishes a `changed` message on `analytics-changes` and acknowledges only when channel publication succeeds.
5. One receive-only browser connection serves the workspace. Messages contain no event payloads, properties, names, or credentials. The selected product scopes refresh behavior in the client. Channel parameters are **not** used as a security partition.

Tako channels are durable with a 60-second replay window. Local development keeps replay in the dev daemon's memory; that is not a production durability test. Piko's API-to-channel queue is intentionally bounded and **not a durable event outbox**. Lost intermediate notifications are harmless because they invalidate queries rather than represent events. Restart/global hints, reconnect reconciliation (including a fresh subscription after HTTP 410 replay expiry), visibility restoration, and manual refresh recover canonical database state.

Overview keeps its existing cards and charts while refreshing, coalescing bursts and allowing at most one foreground query plus one pending refresh. Explore leaves results, pagination, query drafts, and the open event inspector in place until **Refresh results** is clicked. Fixed drilldown date intervals remain fixed; live updates do not silently expand a shared historical selection. Hidden tabs pause query refreshes and catch up on return. The connection indicator shows Live, Reconnecting, or Paused.

## Production and updates

The checked-in configs deliberately contain no production hostnames or servers. Add your selected environment to each config, for example:

```toml
# tako.api.toml
[envs.production]
route = "piko-api.example.com"
servers = ["your-server"]

[vars.production]
PIKO_CHANGE_URL = "https://piko.example.com/_piko/changes"
```

```toml
# tako.dashboard.toml
[envs.production]
route = "piko.example.com"
servers = ["your-server"]

[vars.production]
PIKO_API_URL = "https://piko-api.example.com"
```

Set `PIKO_CHANGE_TOKEN` for production through `tako -c tako.dashboard.toml secrets set PIKO_CHANGE_TOKEN --env production`; the two root configs share this secret store. If the API hostname uses Cloudflare Access service authentication, also configure `PIKO_API_ACCESS_CLIENT_ID` and `PIKO_API_ACCESS_CLIENT_SECRET` in the dashboard SDK secret bag. See [the exact external access boundary](access.md).

Use one server and exactly **one API instance**. The native Rust build must run on Linux with the target server's architecture and libc; a macOS binary is not a Linux deployment artifact. Tako does not cross-compile Rust for this config. Build/deploy the two configs **sequentially** because their local staging directory is shared. Deployment artifacts include the compiled dashboard and the API binary, not local databases.

The API holds an OS lock on its entire persistent directory before opening databases. A second process fails immediately. This protects files but does not make overlapping rolling releases work: Tako normally starts and health-checks the replacement before draining the old process, and DuckDB rejects that overlap.

For an API update, use a maintenance window:

1. Gate **all API ingress** at the private origin/edge, including the dashboard gateway and direct API hostname. Verify a request cannot trigger a new API process.
2. `tako -c tako.api.toml scale 0 --env production`. Confirm the API has zero running instances with `tako status --json`.
3. Deploy the API with `tako -c tako.api.toml deploy --env production` from the matching Linux build environment.
4. `tako -c tako.api.toml scale 1 --env production`. Verify readiness and query committed data through the protected route.
5. Restore API ingress. Deploy the dashboard independently with `tako -c tako.dashboard.toml deploy --env production`.

Scaling to zero alone is **not a maintenance lock**: an incoming request can cold-start the application. Do not delete the app to deploy an update; deletion can remove persistent data. Dashboard-only releases can use normal rolling replacement. Backups still require stopping the API and copying the whole directory consistently. No production deployment or Cloudflare configuration is performed by local setup.

## Verification boundaries

The normal Rust suite covers committed hints, duplicates, typed queries, retention, bounded notification buffering, retry/deadline behavior, and exclusive directory ownership. Browser tests use `PIKO_DASHBOARD_URL` and `PIKO_API_URL` to target the actual Tako hosts. [Verification](verification.md) records the checks actually run; [the benchmark](benchmark.md) measures the standalone Rust database/API path, excluding the channel bridge, dashboard, TLS, and edge.
