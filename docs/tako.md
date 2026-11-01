# Two Tako applications

Piko uses the published Rust SDK for the API and the JavaScript SDK for TanStack Start. Tako itself is unchanged. The API has no dashboard imports: it can optionally emit generic post-commit change hints to a configured HTTP endpoint. The dashboard turns those hints into an ephemeral Tako channel. Use CLI/server release `0.0.0-9ae824f` or later with ephemeral support; the JavaScript SDK is pinned to that release.

## Local development

```sh
bun install --frozen-lockfile
bun dev
SSL_CERT_FILE=.tako/dev-ca.pem PIKO_API_URL=https://piko-api.test bun seed
# Stop only these two apps:
bun run dev:stop
```

After upgrading Tako, restart any existing dev daemon as well as the apps. An app-only `tako dev --restart` does not replace an older daemon. Stop Piko’s apps before restarting it so database owners close cleanly.

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

The channel declares `ephemeral: true`: hints stay in memory, have no replay cursor, and never enter a channel message database. Only currently connected subscribers on the same Tako server receive them. The runtime buffers at most 64 messages per active channel; slow subscribers may miss evicted hints. Messages sent without subscribers or during a disconnect are lost, and restarting the server discards the buffer. See [Tako’s channel semantics](https://github.com/tako-sh/tako/blob/9ae824f876ea74456ed695b1cb5efb577735e960/website/docs/channels.mdx).

Piko’s API-to-channel queue is also bounded and is **not a durable event outbox**. Analytics commits and ingestion acknowledgments remain durable. Notifications invalidate queries rather than represent events. On every connection, including the first, Overview queries canonical API state and Explore offers a refresh without changing its current results. Restart/global hints, visibility restoration, later notifications, and manual refresh also recover missed changes. A connected client can temporarily show stale data if it misses a hint; channel delivery is not a correctness boundary for stored analytics.

Overview keeps its existing cards and charts while refreshing, coalescing bursts and allowing at most one foreground query plus one pending refresh. Explore leaves results, pagination, query drafts, and the open event inspector in place until **Refresh results** is clicked. Fixed drilldown date intervals remain fixed; live updates do not silently expand a shared historical selection. Hidden tabs pause query refreshes and catch up on return. The connection indicator shows Live, Reconnecting, or Paused. Analytical queries retry a capacity response once when the API supplies a numeric `Retry-After` of at most five seconds; changing scope cancels that wait. Longer or unadvertised delays surface a retryable error. Management mutations are never automatically retried.

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

Use one server and exactly **one API instance**. The dashboard’s ephemeral channel also requires all subscribers and publishers to share that Tako server process. Do not configure a shared `postgres_url` credential: Tako currently rejects ephemeral subscriptions and publications in that mode. The native Rust build must run on Linux with the target server's architecture and libc; a macOS binary is not a Linux deployment artifact. Tako does not cross-compile Rust for this config. Build/deploy the two configs **sequentially** because their local staging directory is shared. Deployment artifacts include the compiled dashboard and the API binary, not local databases.

The API holds an OS lock on its entire persistent directory before opening databases. A second process fails immediately. This protects files but does not make overlapping rolling releases work: Tako normally starts and health-checks the replacement before draining the old process, and DuckDB rejects that overlap.

For an API update, use a maintenance window:

1. Gate **all API ingress** at the private origin/edge, including the dashboard gateway and direct API hostname. Verify a request cannot trigger a new API process.
2. `tako -c tako.api.toml scale 0 --env production`. Confirm the API has zero running instances with `tako status --json`.
3. Deploy the API with `tako -c tako.api.toml deploy --env production` from the matching Linux build environment.
4. `tako -c tako.api.toml scale 1 --env production`. Verify readiness and query committed data through the protected route.
5. Restore API ingress. Deploy the dashboard independently with `tako -c tako.dashboard.toml deploy --env production`.

Scaling to zero alone is **not a maintenance lock**: an incoming request can cold-start the application. Do not delete the app to deploy an update; deletion can remove persistent data. Dashboard-only releases can use normal rolling replacement. Backups still require stopping the API and copying the whole directory consistently. No production deployment or Cloudflare configuration is performed by local setup.

## Verification boundaries

The normal Rust suite covers committed hints, duplicates, typed queries, retention, bounded notification buffering, retry/deadline behavior, and exclusive directory ownership. Browser tests run through `bun test:e2e` using dedicated Tako hosts and disposable databases; they never target the preview. [Verification](verification.md) records the checks actually run; [the benchmark](benchmark.md) measures the standalone Rust database/API path, excluding the channel bridge, dashboard, TLS, and edge.

## Browser tests

Run `bun test:e2e`, optionally followed by Playwright file filters or flags. It derives temporary development configs from the real app configs, sets `PIKO_DATA_DIR` explicitly, points the dashboard and change-notification webhook at the test apps, and enables the realtime tests. Test hosts are stable (`piko-e2e.test`, `piko-e2e-api.test`); storage and generated config filenames are unique per run. The preview's database, ingestion keys, and projects are never used. The first addition of test TLS names may reload Tako's local daemon; the runner restores previously registered apps before testing and during teardown.

Normal completion, test failures, Ctrl-C, and SIGTERM stop the test apps before deleting their data. If stopping an app fails, its data/configs are retained and the command fails instead of deleting an open database. A hard kill or machine shutdown cannot run teardown: after confirming no test run is active, use `tako dev list --json`, stop only `piko-e2e` and `piko-e2e-api` if listed (`tako dev stop <name>`), and remove `.tako/e2e/runner.lock`. Once those apps are stopped, abandoned directories under `.tako/e2e/` and root `.tako-e2e-*.toml` files are disposable. Do not remove `.tako/data/`, which holds the preview.
