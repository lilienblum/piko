# Piko

Privacy-first, self-hosted product analytics for websites, CLIs, and developer tools. MIT licensed.

Piko has two independent applications, deployed together:

- **`apps/api`** — Rust/Axum/Tokio. Owns products, ingestion keys, ingestion, and queries. SQLite stores the shared catalog; each product gets its own DuckDB event database. It has no dependency on dashboard code, routes, or assets.
- **`apps/dashboard`** — React/TypeScript with **TanStack Start**, Vite, shadcn/ui, Recharts, and TanStack Table. Runs on **Bun**, serves the UI, and forwards `/api/*` to the Rust service. Authentication is handled by Cloudflare Access, outside the app.

This two-process layout supersedes the original single-process concept. There is still one deployment, one persistent data volume, and no external database. You can run the API on its own.

## Run locally with Tako

Requires [Tako](https://tako.sh/) `0.0.0-9ae824f` or a later release with ephemeral channels, Bun 1.4+, a current stable Rust toolchain (tested with 1.95.0), a C++17 compiler, and local disk. DuckDB is compiled into the API; the first build takes several minutes. No npm or Node runtime is required.

```sh
git clone git@github.com:lilienblum/piko.git
cd piko
bun install --frozen-lockfile
bun dev
```

Open **https://piko.test**. The independent API runs at **https://piko-api.test**. `bun dev` starts both named apps through Tako and creates a shared development notification secret if absent. The secret is encrypted by Tako under the ignored `.tako/` directory. There is no application login. `bun run dev:stop` stops these two apps.

```sh
SSL_CERT_FILE=.tako/dev-ca.pem PIKO_API_URL=https://piko-api.test bun seed
```

This creates one **Orbit** project with **Website**, **iOS app**, and **CLI** sources, with 30 days of sample page views, signups, mobile screens/subscriptions, commands, and configuration events. Earlier demo projects remain untouched. Overview refreshes through ephemeral Tako channels after new events commit; reconnects query the API to catch up. Explore offers **Refresh results** so incoming data does not interrupt inspection or pagination. Stable event IDs make seeding the same UTC dates idempotent; each run creates a fresh sample ingestion key. Sample data is opt-in and never loaded in production automatically.

See [Tako setup, deployment, and realtime delivery](docs/tako.md). Development uses Tako's trusted local HTTPS proxy. If the CLI reports missing host prerequisites, complete `tako doctor` / Tako's local setup first.

## Deployment

The primary deployment consists of **two native Tako apps** described by `tako.api.toml` and `tako.dashboard.toml`. Configure separate production hostnames, a shared notification secret, external access control, and exactly one API instance. Ephemeral channels require one Tako server without a shared Postgres credential. The API uses Tako's persistent data directory. DuckDB requires a **stop-before-start API update**, including an ingress gate to prevent cold starts; see the [deployment procedure](docs/tako.md#production-and-updates).

A standalone alternative remains available, without live channels:

```sh
bun run dev:standalone
# Or build and run the two container services:
docker compose up --build -d
```

Standalone URLs are http://127.0.0.1:3000 (dashboard) and http://127.0.0.1:3001 (API). Docker builds separate targets from [Dockerfile](Dockerfile); only the dashboard is published on loopback. Protect all management access using Cloudflare Tunnel and Access before exposing either app. See [the access boundary](docs/access.md). Piko does not validate Access JWTs or provide fallback authentication.

Without Docker, build with `bun run build` and `cargo build --locked --release -p piko`, then run `./target/release/piko` and `bun run --cwd apps/dashboard start` in separate terminals.

Under Tako, data lives in `$TAKO_DATA_DIR` (locally `.tako/data/app`); standalone data lives in `./data` by default (`state.sqlite`, SQLite WAL files, and `products/<product-id>.duckdb` with their WAL files). Mount `PIKO_DATA_DIR` on durable local storage. Run exactly **one API process per data directory**. Stop the API before copying the entire directory for backup; restore the whole directory together. Do not share the files over a network filesystem. Cleanup logically deletes rows; disk files need not shrink immediately. An eight-instance LRU cache bounds open product databases; active connections pin their instance against eviction. Each instance has a 64 MB DuckDB buffer limit. Query concurrency is bounded globally. Early shared-database MVP data is imported idempotently at startup; the original `events.duckdb` remains as a backup, outside active retention, and can be removed after verifying the import.

| Setting                  | Default                    | Purpose                                                    |
| ------------------------ | -------------------------- | ---------------------------------------------------------- |
| `PIKO_DATA_DIR`          | `TAKO_DATA_DIR` or `data`  | Explicit durable database override                         |
| `PIKO_BIND`              | `127.0.0.1:3001`           | Standalone API address; Tako owns its listener             |
| `PIKO_QUERY_CONCURRENCY` | `4` (1–16)                 | Independent DuckDB query connections                       |
| `PIKO_QUEUE_CAPACITY`    | `64` (1–1024)              | Bounded ingestion request slots/queue                      |
| `PIKO_API_URL`           | `http://127.0.0.1:3001`    | Dashboard-to-API origin                                    |
| `HOST`, `PORT`           | `127.0.0.1`, `3000`        | Standalone Bun dashboard listener                          |
| `PIKO_CHANGE_URL`        | unset outside Tako configs | Optional post-commit notification endpoint                 |
| `PIKO_CHANGE_TOKEN`      | Tako secret                | Shared API-to-dashboard credential; never sent to browsers |

## Use it

1. **Settings:** create a project, then add named **sources** such as Website, iOS app, or CLI. All sources use the same analytics UI. Icons follow the source name automatically, or can be chosen from a predefined Hugeicons set; no URL is needed. Create a key for a specific source and copy it while visible. Only its SHA-256 hash and display prefix are stored.
2. **Overview:** select a project, source (or **All sources**), and date range. Website sources default to `page_view`; tools to `command_run`; mobile/other sources and mixed projects show all events. A combined project shares storage and retention. Missing identity or duration is shown honestly as unavailable.
3. **Explore:** select an event, measure, grouping, and optional typed property filter. Counts, distinct actors, numeric sum/average, and duration p50/p95 run in DuckDB. Charts, grouping, filtering, and event pagination are server-side. Click an event for its original typed envelope.

There is no built-in login, admin token, password, or admin session cookie. Management mutations use an `X-Piko-Admin: 1` request marker to prevent cross-site form submissions; it is not a secret or authorization mechanism. Cloudflare Access is the authentication boundary.

Click an Overview breakdown row to inspect its matching events in Explore. Source and environment tabs expose campaign and CLI version data. See [the dashboard guide](docs/dashboard.md) for drilldowns, typed filters, and date behavior.

See [API and data semantics](docs/api.md), [collection examples and identity](docs/collection.md), and [benchmark methodology/results](docs/benchmark.md).

Existing projects migrate automatically to an initial source; existing keys and counts remain valid. Back up the stopped API's entire data directory before upgrading. Restoring that backup is required to downgrade to a pre-source binary. See [source and migration semantics](docs/api.md#projects-and-sources). The HTTP paths still use `/products` for existing integrations.

## Privacy defaults

Collection starts without visitor, session, or installation identifiers. The browser tracker honors DNT/GPC, leaves campaign capture off until explicitly configured, and offers pre-send filtering plus an opt-out that discards queued data. The CLI example requires an explicit opt-in. New projects created in Settings start with 30-day retention.

Piko does not derive analytics identity from IP addresses or user-agent information. Paths, custom properties, and optional persistent IDs are still data you choose to collect; they are not automatically anonymized. Read [the privacy model and collection controls](docs/privacy.md) before integrating private application routes.

## Checks

```sh
bun fmt
bun fmt:check
bun typecheck
bun lint
bun test
bun run build
cargo test
cargo clippy --all-targets --all-features -- -D warnings
```

`bun test` runs SDK and notification validation tests (scoped by `bunfig.toml`). `bun test:e2e` runs real Chromium tests. For Tako, run `SSL_CERT_FILE=.tako/dev-ca.pem PIKO_REALTIME=1 PIKO_DASHBOARD_URL=https://piko.test PIKO_API_URL=https://piko-api.test bun test:e2e`; without overrides it targets standalone ports 3000/3001. Start the app first. The browser suite creates its own small fixtures; no login or seed is needed. If Chromium is absent, install it with `bun node_modules/@playwright/test/cli.js install chromium`.

```sh
cargo build --release -p piko
bun benchmark
```

The benchmark starts its own API process with a temporary data directory and deletes only that directory afterward. It never writes to your running workspace. See its report for **measured** throughput, latency, and memory; no production capacity claim is implied.

See [the verification record](docs/verification.md) for measured checks and their limits.

## Scope and limitations

- External access control, one local API process, one disk. Tako API updates require a brief maintenance window; normal rolling overlap is unsupported. No replication, multi-user permissions, automatic backups, or online schema migration framework yet.
- Browser ingestion keys are intentionally public and write-only. They are not anti-abuse credentials; a key holder can submit fabricated events. There is global capacity backpressure, but no per-key fairness or bot detection.
- Identity is explicit, optional, and project-scoped. There is no IP/user-agent fingerprinting. The browser tracker defaults to unidentified events and always honors Do Not Track and Global Privacy Control. Installations are distinct from website visitors and sessions.
- All dashboard displays and bucket boundaries use UTC in v1. Date ranges are half-open; today is partial. No local-time/DST bucket selection yet.
- Pagination is bounded offset pagination, ordered by time and event ID. Each query uses a consistent database snapshot, but different pages may shift when new events arrive. Top breakdowns are limited to 12 groups, event-name discovery to 100 names, filters to 8, pages to 10,001, and page size to 100.
- Delivery from browsers/CLIs is best effort with bounded retries. A flush confirms attempted delivery, not guaranteed delivery. Deduplication lasts while the event remains retained, not forever.
- No logs/search, arbitrary SQL, funnels, replay, dashboard builders, or distributed storage.

[Liwan](https://github.com/explodingcamera/liwan) informed the embedded-storage direction. Piko has its own implementation and product model, with equal support for websites and tools.

### Dashboard appearance

Use the Appearance menu in the top-right corner to choose **Light**, **Dark**, or **Auto**. Auto follows your system setting, including changes while the dashboard is open. The preference persists in this browser and synchronizes across tabs. The saved theme is applied before the application loads.

The sidebar toggle collapses desktop navigation to icons and opens a navigation drawer on mobile. Project, source, and date selectors remain available in the header. Dashboard controls use shadcn/ui Select, Sidebar/Sheet, Collapsible, Tabs, AlertDialog, and Chart alongside its buttons, forms, cards, and tables.

The Yuzu visual system uses butter-yellow navigation, warm ink, ochre charts, and locally served Geist (with its [font license](apps/dashboard/public/licenses/geist.txt)). Squared controls, solid active navigation, underline toolbar selectors, and the shared three-bar logo/favicon give the existing shadcn primitives a distinct Piko treatment. Analytical sections stay flat; forms and inspectors retain clear boundaries. [Product context](apps/dashboard/PRODUCT.md) and [design rules](apps/dashboard/DESIGN.md) document the decisions for future UI work.
