# Piko

- Use Bun for JavaScript commands, including `bun fmt`, `bun typecheck`, `bun lint`, and `bun test`. Do not use npm or Node.
- `apps/api` is the independent Rust HTTP API. `apps/dashboard` is TanStack Start on Bun and proxies /api requests. The API knows nothing about the dashboard. SQLite owns management state; each product has its own DuckDB file under data/products/. Authentication belongs to Cloudflare Access; never add a built-in login or admin token. Keep public ingestion keys. Keep blocking database work off Tokio HTTP workers.
- Keep ingestion acknowledgments after commit, bounded queues, product-scoped deduplication, and typed properties intact.
- Run `bun fmt`, `bun typecheck`, `bun lint`, `bun test`, `bun run build`, `cargo test`, and `cargo clippy --all-targets --all-features -- -D warnings` for relevant changes.
- MIT license. Keep documentation and collection examples aligned with API changes.
