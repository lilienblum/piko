# Piko

Small, self-hosted product analytics for websites, CLIs, and developer tools. MIT licensed.

Piko has two independent applications, deployed together:

- **`apps/api`** — Rust/Axum/Tokio. Owns products, ingestion keys, ingestion, and queries. SQLite stores the shared catalog; each product gets its own DuckDB event database. It has no dependency on dashboard code, routes, or assets.
- **`apps/dashboard`** — React/TypeScript with **TanStack Start**, Vite, shadcn/ui, Recharts, and TanStack Table. Runs on **Bun**, serves the UI, and forwards `/api/*` to the Rust service. Authentication is handled by Cloudflare Access, outside the app.

This two-process layout supersedes the original single-process concept. There is still one deployment, one persistent data volume, and no external database. You can run the API on its own.

## Run locally

Requires Bun 1.4+, a current stable Rust toolchain (tested with 1.99.1), a C++17 compiler, and local disk. DuckDB is compiled and linked into the Rust binary; the first build takes several minutes. No npm or Node runtime is required.

```sh
git clone git@github.com:lilienblum/piko.git
cd piko
bun install --frozen-lockfile
cp .env.example .env # optional development overrides
bun dev
```

Open **http://127.0.0.1:3000**. There is no application login. The API listens on **127.0.0.1:3001**. `bun dev` passes the `.env` configuration to both child processes. In a second terminal:

```sh
bun seed
```

This creates **Orbit website** and **Orbit CLI**, with 30 days of sample page views, signups, commands, and configuration events. Reload the dashboard after seeding. Stable event IDs make seeding the same UTC dates idempotent; it creates a fresh sample ingestion key on each run. Sample data is opt-in and never loaded in production automatically.

For independent processes:

```sh
# Terminal 1
cargo run -p piko

# Terminal 2: Bun loads .env automatically.
bun dev:dashboard
```

## Production

```sh
# No application secrets are needed:
docker compose up --build -d
```

Docker builds separate API and dashboard targets from [Dockerfile](Dockerfile). Only the dashboard is published on loopback port 3000; the API is private to the Compose network. Use Cloudflare Tunnel and Access to protect the dashboard and management API before exposing them. Public collectors need narrowly scoped Access bypasses for ingestion and the tracker; see [the access boundary](docs/access.md). Piko does not validate Access JWTs or provide fallback authentication: a publicly reachable origin would expose management.

Without Docker:

```sh
bun run build
cargo build --locked --release -p piko
./target/release/piko
# In another terminal:
bun run --cwd apps/dashboard start
```

Data lives in `./data` by default (`state.sqlite`, SQLite WAL files, and `products/<product-id>.duckdb` with their WAL files). Mount `PIKO_DATA_DIR` on durable local storage. Run exactly **one API process per data directory**. Stop the API before copying the entire directory for backup; restore the whole directory together. Do not share the files over a network filesystem. Cleanup logically deletes rows; disk files need not shrink immediately. An eight-instance LRU cache bounds open product databases; active connections pin their instance against eviction. Each instance has a 64 MB DuckDB buffer limit. Query concurrency is bounded globally. Early shared-database MVP data is imported idempotently at startup; the original `events.duckdb` remains as a backup, outside active retention, and can be removed after verifying the import.

| Setting                  | Default                 | Purpose                               |
| ------------------------ | ----------------------- | ------------------------------------- |
| `PIKO_DATA_DIR`          | `data`                  | Durable database directory            |
| `PIKO_BIND`              | `127.0.0.1:3001`        | API address                           |
| `PIKO_QUERY_CONCURRENCY` | `4` (1–16)              | Independent DuckDB query connections  |
| `PIKO_QUEUE_CAPACITY`    | `64` (1–1024)           | Bounded ingestion request slots/queue |
| `PIKO_API_URL`           | `http://127.0.0.1:3001` | Dashboard-to-API origin               |
| `HOST`, `PORT`           | `127.0.0.1`, `3000`     | Production Bun dashboard listener     |

## Use it

1. **Settings:** create a website, developer tool, or generic product; no URL is needed. Create an ingestion key and copy it while visible. Only its SHA-256 hash and display prefix are stored.
2. **Overview:** select a product and date range. Websites default to `page_view`; tools default to `command_run`; generic products show all events. Any product may receive any source. Missing identity or duration is shown honestly as unavailable.
3. **Explore:** select an event, measure, grouping, and optional typed property filter. Counts, distinct actors, numeric sum/average, and duration p50/p95 run in DuckDB. Charts, grouping, filtering, and event pagination are server-side. Click an event for its original typed envelope.

There is no built-in login, admin token, password, or admin session cookie. Management mutations use an `X-Piko-Admin: 1` request marker to prevent cross-site form submissions; it is not a secret or authorization mechanism. Cloudflare Access is the authentication boundary.

Click an Overview breakdown row to inspect its matching events in Explore. Source and environment tabs expose campaign and CLI version data. See [the dashboard guide](docs/dashboard.md) for drilldowns, typed filters, and date behavior.

See [API and data semantics](docs/api.md), [collection examples and identity](docs/collection.md), and [benchmark methodology/results](docs/benchmark.md).

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

`bun test` runs the dependency-free SDK tests (scoped by `bunfig.toml`). `bun test:e2e` runs real Chromium browser tests against local processes on ports 3000/3001. Start the app first. The browser suite creates its own small fixtures; no login or seed is needed. If Chromium is absent, install it with `bun x --bun playwright install chromium`.

```sh
cargo build --release -p piko
bun benchmark
```

The benchmark starts its own API process with a temporary data directory and deletes only that directory afterward. It never writes to your running workspace. See its report for **measured** throughput, latency, and memory; no production capacity claim is implied.

See [the verification record](docs/verification.md) for measured checks and their limits.

## Scope and limitations

- External access control, one local API process, one disk. No replication, multi-user permissions, automatic backups, or online schema migration framework yet.
- Browser ingestion keys are intentionally public and write-only. They are not anti-abuse credentials; a key holder can submit fabricated events. There is global capacity backpressure, but no per-key fairness or bot detection.
- Identity is explicit, optional, and product-scoped. There is no IP/user-agent fingerprinting. The browser tracker defaults to anonymous events and respects Do Not Track by default. Installations are distinct from website visitors and sessions.
- All dashboard displays and bucket boundaries use UTC in v1. Date ranges are half-open; today is partial. No local-time/DST bucket selection yet.
- Pagination is bounded offset pagination, ordered by time and event ID. Each query uses a consistent database snapshot, but different pages may shift when new events arrive. Top breakdowns are limited to 12 groups, event-name discovery to 100 names, filters to 8, pages to 10,001, and page size to 100.
- Delivery from browsers/CLIs is best effort with bounded retries. A flush confirms attempted delivery, not guaranteed delivery. Deduplication lasts while the event remains retained, not forever.
- No logs/search, arbitrary SQL, funnels, replay, dashboard builders, or distributed storage.

[Liwan](https://github.com/explodingcamera/liwan) informed the embedded-storage direction. Piko has its own implementation and product model, with equal support for websites and tools.

### Dashboard appearance

Use the Appearance menu in the top-right corner to choose **Light**, **Dark**, or **Auto**. Auto follows your system setting, including changes while the dashboard is open. The preference persists in this browser and synchronizes across tabs. The saved theme is applied before the application loads.

The sidebar toggle collapses desktop navigation to icons and opens a navigation drawer on mobile. Product and date selectors remain available in the header. Dashboard controls use shadcn/ui Select, Sidebar/Sheet, Collapsible, Tabs, AlertDialog, and Chart alongside its buttons, forms, cards, and tables.
