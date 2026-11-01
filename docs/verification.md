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
| `bun test:e2e`                                             | 20 Chromium tests pass                                                     |
| `bun scripts/verify-cli.ts`                                | Actual Rust CLI event committed; correct installation and numeric duration |
| `docker compose config --quiet`                            | Pass                                                                       |
| `bun benchmark`                                            | Completed; exact persisted-count assertion passes                          |

The API tests exercise single and batch ingestion, invalid batch atomicity, deduplication, separate product credentials/files, first-class typed numeric aggregation, percentiles, boolean filtering, product-specific retention, query admission backpressure, concurrent reads/writes, and restart persistence. Storage tests verify bounded cache behavior, active-connection pins, and idempotent migration from the early shared database. The telemetry test uses a real local TCP peer that hangs, proving bounded shutdown and immediate queue-full rejection.

The Chromium suite exercises both product overviews, numeric Explore results, typed filters, server-side pagination, date changes, product creation, retention edits, key creation/revocation, empty states, and 390 px layouts. A separate-origin fixture imports the real tracker bundle and sends initial/SPA/custom events, preserving boolean/number/string types and visitor/session identity across reloads.

The dashboard follow-up also verifies real shadcn Select keyboard interaction, collapsible filters, sidebar collapse persistence, a mobile navigation drawer, and integration tabs. Theme checks cover Light/Dark/Auto, explicit overrides, reload persistence, live system-theme changes, cross-tab synchronization, and applying the saved theme before application JavaScript loads.

The overview drilldown follow-up adds seven browser tests. They exercise website paths, referrers and campaigns; CLI commands and versions in a narrow dark layout; native source predicates for generic products; shares against the full result count; fixed UTC dates and product selection across reload and history; numeric, boolean and string equality; malformed and missing-product links; and pending/error/retry states. The final 15-test production-bundle run passed in 33.9 seconds. Manual inspection confirmed the Orbit website newsletter drilldown and Orbit CLI version drilldown. An unrelated-route search bug and a repeated-validation bug were reproduced and fixed before the passing run.

Manual browser inspection covered desktop website and CLI overviews, Explore, Settings, and narrow-screen layout. Both preview processes were restarted against the same data directory; the sample events remained visible. The per-product import preserved the existing sample counts. The actual Rust CLI example appeared with one command execution, one installation, 100% success, and a numeric duration. No built-in login appears in the final UI.

Limitations: Docker image build/start was not run because the host Docker daemon is unavailable. Compose syntax was validated. Cloudflare Access/Tunnel was not provisioned in a live account; the repository documents the required edge policy and origin boundary. Power-loss durability, filesystem failure injection, and long-running soak tests were not performed.

The Event stream follow-up adds five browser tests. They verify contextual website/tool rows, keyboard inspection and focus restoration, adjacent-event navigation, full metadata and JSON, JSON-preserving clipboard actions and failures, typed property filtering from applied query state, server page sizes, stable charts and loading rows, retry of the exact failed page and UTC interval, product switching, and long values in a 390 px dark inspector. All 20 browser tests passed against the production bundle in 56.4 seconds. Manual review covered website properties and a CLI success filter producing 3,463 matching events. The existing newer/older focus issue was reproduced before correction; failed-page retry is covered by an injected 503 response.

This dashboard change leaves Rust, the API contract, and the benchmark harness unchanged. The Bun formatting, type, lint, SDK test, production build, and browser checks were rerun. The Rust and benchmark results above remain the measurements from the preceding API verification.
