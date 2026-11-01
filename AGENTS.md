# Piko

- Use Bun for JavaScript commands, including `bun fmt`, `bun typecheck`, `bun lint`, and `bun test`. Do not use npm or Node.
- Rust owns the HTTP API and serves `dist/`. SQLite owns management state; DuckDB owns events. Keep blocking database work off Tokio HTTP workers.
- Keep ingestion acknowledgments after commit, bounded queues, product-scoped deduplication, and typed properties intact.
- Run `bun fmt`, `bun typecheck`, `bun lint`, `bun test`, `bun run build`, `cargo test`, and `cargo clippy --all-targets --all-features -- -D warnings` for relevant changes.
- MIT license. Keep documentation and collection examples aligned with API changes.
