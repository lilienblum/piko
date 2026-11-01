# Verification record

Verified locally on 1 November 2026 against the two-app Tako architecture, with per-product databases and external access control. Latest toolchain: Bun 1.4.4, Rust 1.95.0, Tako CLI 0.0.0-00ac4d2, JavaScript SDK 0.0.0-9301901, Rust SDK 0.2.1.

| Check                                                      | Result                                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `bun fmt` and `bun fmt:check`                              | Pass                                                                           |
| `bun typecheck`                                            | Pass                                                                           |
| `bun lint`                                                 | Pass, no warnings                                                              |
| `bun test`                                                 | 9 SDK/gateway/notification tests pass                                          |
| `bun run build`                                            | TanStack Start client/server, Tako entry wrapper, CORS tracker route           |
| `cargo test`                                               | 17 Rust tests pass (6 unit, 8 API, 2 delivery, 1 process runtime)              |
| `cargo clippy --all-targets --all-features -- -D warnings` | Pass                                                                           |
| `cargo build --release -p piko`                            | Pass                                                                           |
| `bun test:e2e`                                             | 54 Chromium tests pass on Tako; 27 previously passed on compiled standalone    |
| `bun scripts/verify-cli.ts`                                | CLI opt-in/opt-out, optional identity, command redaction, and numeric duration |
| `docker compose config --quiet`                            | Pass                                                                           |
| `bun benchmark`                                            | Completed; exact persisted-count assertion passes                              |

The API tests exercise single and batch ingestion, invalid batch atomicity, deduplication, separate product credentials/files, first-class typed numeric aggregation, percentiles, boolean filtering, product-specific retention, query admission backpressure, concurrent reads/writes, and restart persistence. Storage tests verify bounded cache behavior, active-connection pins, and idempotent migration from the early shared database. The telemetry test uses a real local TCP peer that hangs, proving bounded shutdown and immediate queue-full rejection.

The Chromium suite exercises both product overviews, numeric Explore results, typed filters, server-side pagination, date changes, product creation, retention edits, key creation/revocation, empty states, and 390 px layouts. A separate-origin fixture imports the real tracker bundle and sends initial/SPA/custom events, preserving boolean/number/string types and visitor/session identity across reloads.

The dashboard follow-up also verifies real shadcn Select keyboard interaction, collapsible filters, sidebar collapse persistence, a mobile navigation drawer, and integration tabs. Theme checks cover Light/Dark/Auto, explicit overrides, reload persistence, live system-theme changes, cross-tab synchronization, and applying the saved theme before application JavaScript loads.

The overview drilldown follow-up adds seven browser tests. They exercise website paths, referrers and campaigns; CLI commands and versions in a narrow dark layout; native source predicates for generic products; shares against the full result count; fixed UTC dates and product selection across reload and history; numeric, boolean and string equality; malformed and missing-product links; and pending/error/retry states. The final 15-test production-bundle run passed in 33.9 seconds. Manual inspection confirmed the Orbit website newsletter drilldown and Orbit CLI version drilldown. An unrelated-route search bug and a repeated-validation bug were reproduced and fixed before the passing run.

Manual browser inspection covered desktop website and CLI overviews, Explore, Settings, and narrow-screen layout. Both preview processes were restarted against the same data directory; the sample events remained visible. The per-product import preserved the existing sample counts. The actual Rust CLI example appeared with one command execution, one installation, 100% success, and a numeric duration. No built-in login appears in the final UI.

Limitations: Docker image build/start was not run because the host Docker daemon is unavailable. Compose syntax was validated. Cloudflare Access/Tunnel was not provisioned in a live account; the repository documents the required edge policy and origin boundary. Power-loss durability, filesystem failure injection, and long-running soak tests were not performed.

The Event stream follow-up adds five browser tests. They verify contextual website/tool rows, keyboard inspection and focus restoration, adjacent-event navigation, full metadata and JSON, JSON-preserving clipboard actions and failures, typed property filtering from applied query state, server page sizes, stable charts and loading rows, retry of the exact failed page and UTC interval, product switching, and long values in a 390 px dark inspector. All 20 browser tests passed against the production bundle in 56.4 seconds. Manual review covered website properties and a CLI success filter producing 3,463 matching events. The existing newer/older focus issue was reproduced before correction; failed-page retry is covered by an injected 503 response.

The loading-state follow-up adds seven browser tests. Held requests verify catalog placeholders with usable navigation, Overview card geometry within 12 px of loaded content, isolated breakdown loading, Explore-specific placeholders and pending buttons, 390 px dark layouts with reduced motion, key-list loading/error/empty separation, and local retries. Mutation checks cover pending save/create/revoke operations, key preservation after a failed list refresh, exact key-ID matching despite a shared display prefix, visible revoke errors inside the dialog, and product creation followed by a catalog failure without a duplicate POST. The initial HTML contains a placeholder before JavaScript executes. False empty-key output and the hidden revoke error were reproduced before correction. All 27 Chromium tests passed against the final production bundle in 47.9 seconds. Manual review covered the Orbit website Overview, Explore navigation, CLI Settings, and desktop/mobile loading screenshots. Router configuration now removes the default 500 ms minimum pending display; this is a UI timing change, not a new backend performance measurement.

The loading-only iteration above left Rust and the benchmark harness unchanged. The subsequent Tako migration below reran Rust and benchmark verification.


## Tako runtime and durable channels

Two native apps were exercised at `https://piko.test` and `https://piko-api.test`, with certificate verification enabled. Existing sample data was copied while the former API was stopped, then read successfully under Tako's persistent directory. The original directory was retained. Manual browser review covered Orbit website Overview and Orbit CLI Explore/typed event inspection, with the Live indicator connected.

All **33 browser tests passed in 2.0 minutes** through Tako. Six realtime tests verify committed refreshes while keeping chart DOM mounted; product-scoped notifications; duplicate retries producing no refresh; Explore preserving pagination, draft filters, and an open inspector; reconnect after an interrupted SSE stream; rejection of ingestion keys at the notification endpoint; expired replay recovery; and retry after a transient runtime-capability failure. Stream interruption and HTTP 410 are injected deterministically before continuing onto the actual channel. A fresh cursor and canonical query are checked after expiry. Local channel replay remains in the daemon's memory; production durable replay was not tested remotely.

The **27 existing UI tests passed in 52.5 seconds** against the compiled standalone dashboard on port 3100, forwarding to the managed API. That mode explicitly reports live=false and retains manual refresh. Both modes passed the separate-origin real browser-tracker test. The actual Rust CLI example also committed one execution, one installation, a boolean result, and numeric duration over Tako HTTPS.

The 16 Rust tests include real subprocess coverage, beyond router-level tests: standalone HTTP continues working after a forged internal-status host request; a competing process fails on the directory lock; a committed event survives SIGKILL and restart; its numeric sum remains 42; retrying its ID reports a duplicate. The managed API was separately killed and restarted through Tako against the same directory, verifying the same count/sum/dedup behavior. Notification tests cover post-commit visibility, duplicate-only silence, retention-only changes, bounded overflow, failed delivery, retries, and an 800 ms request deadline.

Verification reproduced and corrected lost readiness descriptors from an indirect executable launcher, standalone SDK bootstrap interfering with Tokio's descriptors, expired replay cursors that otherwise retry forever, and one-shot capability failure. The project now invokes JavaScript tools directly with Bun. The independent review also corrected native deployment's explicit start path. Tako itself was not modified.

The release benchmark was rerun after the runtime fix: **15,142 newly committed events/sec**, query p95 **105.4 ms**, sampled peak API RSS **252.5 MiB**, zero request failures, and exactly 238,300 persisted events. See [the benchmark report](benchmark.md) for hardware, workload, raw measurements, and exclusions. This is the standalone Rust path, not a production Tako/channel throughput measurement.

Production deployment, Linux artifact execution, Cloudflare policies, and Docker image startup were not exercised on this host. Compose syntax and the compiled standalone runtime were verified. The documented API maintenance procedure is required because DuckDB cannot overlap old and new processes during a rolling release. No claim of power-loss durability or long-running production capacity is made.


## Stable manual refresh

Manual refresh previously detached Overview cards/charts and Explore results while loading, and reset Explore pagination as the rolling interval advanced. Browser tests reproduced both detachments before the fix. Refresh now preserves the current result scope and page, with activity icons in place. The live-data action occupies a fixed-size button in the query header, so announcing or acknowledging new data does not insert or remove a banner. A failed refresh retains known results and offers retry feedback.

All **38 Chromium tests passed in 2.1 minutes** against the two running Tako apps. Five refresh regressions hold responses to check retained DOM nodes and identical card geometry, page-two preservation, 503 recovery, and a 390 px layout. The live CLI test also checks stable query-card geometry when new data arrives and while refreshing. Existing tests continue to verify that changed dates/queries use placeholders and pagination loads the requested server rows. Manual in-app browser review covered both sample products, including CLI page-two refresh and website Explore.

`bun fmt`, `bun fmt:check`, `bun typecheck`, `bun lint`, `bun test` (five tests), and `bun run build` passed. The build retains its existing large-client-chunk warning. This iteration changes frontend state and presentation only; the Rust backend, persistence behavior, and benchmark measurements above are unchanged.


## Hugeicons migration

All dashboard icons and installed shadcn controls now use native Hugeicons icon data and the official React renderer. Lucide was removed from the dependency graph. The shadcn CLI confirms `iconLibrary: hugeicons` with the existing Radix base. Manual browser review covered Settings, appearance-menu icons and its filled selection dot, and select chevrons/checkmarks.

The existing **38 Chromium tests passed in 2.3 minutes**, including website/CLI flows, keyboard navigation, themes, narrow layouts, loading feedback, and stable refresh. No new tests were added for this visual replacement. `bun fmt`, `bun typecheck`, `bun lint`, five Bun tests, and the production build passed. The main client chunk is 948.82 kB (293.68 kB gzip); the existing chunk-size warning remains. The Rust backend and prior ingestion benchmarks are unchanged.


## Collapsed sidebar alignment

The reported collapsed sidebar was reproduced in the user's existing localhost tab and again after loading the current Hugeicons build. Each navigation SVG was 8 px left of its button center because the large-button variant removed padding without centering content. Two collapsed-only alignment utilities now center menu items in the rail and center icons in their existing square buttons. Browser measurements changed from `iconOffsetX: -8` to `iconOffsetX: 0` and `iconOffsetY: 0` for Overview, Explore, Settings, and Documentation.

Four existing sidebar/theme/mobile Chromium checks passed in 16.5 seconds, with a temporary 894×870 dark screenshot capture matching the reported viewport. The capture instrumentation was removed afterward. Bun formatting, typecheck, lint, five unit tests, and the production build passed. Manual review also confirmed the current preview at `https://piko.test/explore`, where Tako serves live channels.


## Overview chart metrics and intervals

The Overview chart now supports product-specific metrics and daily/hourly intervals through the existing bounded query API. Daily event counts reuse the main query; selecting another metric or interval adds one request with an event page size of one. Summary cards and count breakdowns keep their original scope. Website visitors and CLI installations use distinct identity-kind predicates.

Four new browser tests verify mixed identities, numeric duration types, and stable selection/refresh behavior. Six page views containing two distinct visitor IDs, one installation ID, and anonymous activity still show six total views while the visitor chart reports two. Durations of 100 and 300 ms produce a 200 ms average and 290 ms p95; string and boolean values are excluded. Generic identities with the same actor ID remain separate by kind. Additional assertions cover the 90-day fallback to daily buckets, explicit empty states, local retry after 503, unchanged chart geometry, visible isolated duration samples, and unclipped axes at 390 px.

All **42 Chromium tests passed in 2.7 minutes** with `PIKO_REALTIME=1` against the two running Tako apps. One existing text assertion was scoped to the summary cards because the same metric label now also appears in the chart control. The final suite includes all six durable-channel tests and all five stable-refresh regressions. Temporary screenshot capture for the seeded website and CLI views was removed before committing. Manual browser review covered visitor, duration, and hourly selections with unchanged overview totals.

`bun fmt`, `bun typecheck`, `bun lint`, five Bun unit tests, and `bun run build` passed. The existing large-client-chunk warning remains (950.13 kB, 294.10 kB gzip). This iteration changes the dashboard only; backend behavior and benchmark measurements above are unchanged.


## Privacy-first collection

Browser collection now starts without IDs or campaigns, honors DNT/GPC without an override, and exposes explicit path/referrer controls, a pre-send sanitizer, and an opt-out that discards pending events. SDK requests omit cookies and Referer and refuse redirects. The dashboard gateway allows only API/CORS headers, forwards ingestion authorization only on the ingestion route, and keeps server-side Access credentials separate. The Rust CLI example requires explicit telemetry opt-in, honors `DO_NOT_TRACK=1`, and maps unknown commands to `other`.

All **54 Chromium tests passed in 2.7 minutes** against the two Tako apps with durable channels enabled. The twelve new cases exercise anonymous defaults, typed properties, no campaign capture without an allowlist, inert disabled/DNT/GPC startup, sanitization and mutation protection, scoped identity cleanup, changed privacy signals, active-request cancellation, redirect rejection, storage-read/write failure, and Settings defaults. Actual requests show no Cookie or Referer, including the tracker module import. Settings creates products with 30-day retention while preserving an existing 90-day choice. Manual browser review covered both website and CLI integration snippets.

`bun fmt`, `bun typecheck`, `bun lint`, nine Bun tests, `bun run build`, all 17 Rust tests, and strict Clippy passed. The gateway test uses a real local HTTP peer to inspect forwarded headers and bodies. Rust redirect tests cover 307 and 308 with zero requests at the redirect destination; the live CLI verification confirms opt-in, Do Not Track, optional installation identity, command redaction, and numeric duration both directly against the API and through the dashboard proxy used by integration snippets.

The existing client chunk warning remains (950.13 kB, 294.10 kB gzip). API event storage, queries, and benchmark behavior are unchanged. These checks prove collection behavior in the tested clients, not automatic personal-data detection or legal compliance; infrastructure logs, existing explicit identity choices, previously stored events, and backups retain their separately documented boundaries in [the privacy model](privacy.md).

## Impeccable dashboard redesign

Initialized the dashboard's [product context](../apps/dashboard/PRODUCT.md), [design system](../apps/dashboard/DESIGN.md), and machine-readable design sidecar. The user delegated setup answers and design choices. The resulting system replaces the blue card grid with stone surfaces, pine/citron themes, locally served Public Sans, flat analytical sections, and contained editing surfaces. The existing shadcn primitives, Hugeicons, theme persistence, typed events, and privacy behavior remain.

Reviewed eight rendered combinations across Overview, Explore, and Settings: website and CLI products, Light and Dark, 1440px desktop widths and a 390×844px narrow viewport. No document overflow was measured. Sampled supporting text met 4.5:1 contrast; the light input stroke was adjusted to reach 3.06:1 against the workspace and 3.26:1 against white fields. This is a targeted contrast review, not a claim of a complete accessibility audit. Keyboard review verified the new skip link and existing navigation/inspection behavior.

The finish review requested denser desktop Explore results. The final 1440×960px website view places the event stream at y=573.83px, with 56px rows and five complete events visible. Mobile retains stacked context and larger touch controls. Refresh geometry remains stable. The initial Explore placeholder now uses three breakdown rows to match the compact chart region; the loading regression asserts that the stream's initial and loaded desktop positions differ by at most 12px.

The full browser run passed **55 checks in 3.0 minutes**: all **54 committed behavior tests**, including durable channels and refresh regressions, plus one temporary eight-view capture harness. After the final placeholder adjustment, all seven loading tests and the loaded-preview capture passed again. The temporary harness was removed. `bun fmt`, `bun fmt:check`, `bun typecheck`, `bun lint`, nine Bun tests, and the production build passed. Impeccable's manual detector returned no findings. The existing large-client-chunk warning remains (950.26 kB, 294.19 kB gzip). This iteration changes the dashboard and its documentation; Rust behavior and prior benchmark measurements are unchanged.
