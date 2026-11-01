# Verification record

Verified locally on 1 November 2026 against the final two-process, per-product database, externally authenticated architecture.

| Check                                                      | Result                                                                     |
| ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| `bun fmt` and `bun fmt:check`                              | Pass                                                                       |
| `bun typecheck`                                            | Pass                                                                       |
| `bun lint`                                                 | Pass, no warnings                                                          |
| `bun test`                                                 | 3 SDK tests pass                                                           |
| `bun run build`                                            | TanStack Start client/server and standalone tracker build                  |
| `cargo test`                                               | 9 Rust tests pass (2 storage, 6 API, 1 delivery deadline)                  |
| `cargo clippy --all-targets --all-features -- -D warnings` | Pass                                                                       |
| `cargo build --release -p piko`                            | Pass                                                                       |
| `bun test:e2e`                                             | 4 Chromium tests pass                                                      |
| `bun scripts/verify-cli.ts`                                | Actual Rust CLI event committed; correct installation and numeric duration |
| `docker compose config --quiet`                            | Pass                                                                       |
| `bun benchmark`                                            | Completed; exact persisted-count assertion passes                          |

The API tests exercise single and batch ingestion, invalid batch atomicity, deduplication, separate product credentials/files, first-class typed numeric aggregation, percentiles, boolean filtering, product-specific retention, query admission backpressure, concurrent reads/writes, and restart persistence. Storage tests verify bounded cache behavior, active-connection pins, and idempotent migration from the early shared database. The telemetry test uses a real local TCP peer that hangs, proving bounded shutdown and immediate queue-full rejection.

The Chromium suite exercises both product overviews, numeric Explore results, typed filters, server-side pagination, date changes, product creation, retention edits, key creation/revocation, empty states, and 390 px layouts. A separate-origin fixture imports the real tracker bundle and sends initial/SPA/custom events, preserving boolean/number/string types and visitor/session identity across reloads.

Manual browser inspection covered desktop website and CLI overviews, Explore, Settings, and narrow-screen layout. Both preview processes were restarted against the same data directory; the sample events remained visible. The per-product import preserved the existing sample counts. The actual Rust CLI example appeared with one command execution, one installation, 100% success, and a numeric duration. No built-in login appears in the final UI.

Limitations: Docker image build/start was not run because the host Docker daemon is unavailable. Compose syntax was validated. Cloudflare Access/Tunnel was not provisioned in a live account; the repository documents the required edge policy and origin boundary. Power-loss durability, filesystem failure injection, and long-running soak tests were not performed.
