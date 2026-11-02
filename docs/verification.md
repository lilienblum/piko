# Verification record

Verified locally on 1 November 2026 against the two-app Tako architecture, with per-product databases and external access control. Latest toolchain: Bun 1.4.4, Rust 1.95.0, Tako CLI 0.0.0-00ac4d2, JavaScript SDK 0.0.0-9301901, Rust SDK 0.2.1.

| Check                                                      | Result                                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `bun fmt` and `bun fmt:check`                              | Pass                                                                           |
| `bun typecheck`                                            | Pass                                                                           |
| `bun lint`                                                 | Pass, no warnings                                                              |
| `bun test`                                                 | 16 SDK/gateway/notification/benchmark tests pass                               |
| `bun run build`                                            | TanStack Start client/server, Tako entry wrapper, CORS tracker route           |
| `cargo test`                                               | 21 Rust tests pass (8 unit, 10 API, 2 delivery, 1 process runtime)             |
| `cargo clippy --all-targets --all-features -- -D warnings` | Pass                                                                           |
| `cargo build --release -p piko`                            | Pass                                                                           |
| `bun test:e2e`                                             | 60 Chromium tests pass on Tako; 27 previously passed on compiled standalone    |
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


## Ponytail code review

Reviewed API storage/ingestion/query paths, collectors, gateway/realtime handling, dashboard state, and local tooling. Changes address concrete failure cases without schema migrations or additional dependencies:

- Writer shutdown waits for a full queue to drain; query ranges enforce exact 366-day/31-day boundaries.
- The gateway caps pending ingestion uploads at 64 and includes body reading in its 13-second deadline. Stalled streams cancel without waiting for their cleanup; overload returns 503 with retry/CORS headers. Cross-origin collectors can read `Retry-After`.
- SDK cancellation interrupts backoff, invalid delivery limits fail early, and permanent errors with a null JSON body are not retried. Browser shutdown drains accepted batches within one total deadline. Automatic batches also respect a byte budget so large valid events do not exceed the API body limit. Bodies above the browser's 64 KiB keepalive limit use ordinary fetch while the page is open.
- Blocked browser storage no longer prevents loading, product creation, selection, date changes, themes, or sidebar use. Removed an unread sidebar cookie and the duplicate `cn` dependency in favor of the existing helper.
- The benchmark refuses an occupied port before making requests and bounds startup probes.

`bun fmt`, `bun fmt:check`, `bun typecheck`, `bun lint`, all **16 Bun tests**, the production dashboard build, all **19 Rust tests**, strict Clippy, and the locked release API build passed. All **58 Chromium tests passed in 2.9 minutes**, including four new browser regressions. After the final byte-budget adjustment, all 14 collector browser tests passed again. After restarting both local Tako applications with the new code, the website/tool query flow and both website/CLI live-update flows passed again; the running API exposes the retry header.

A separate two-second benchmark smoke run with 1,000 preloaded events committed 34,200 new events, acknowledged 3,200 duplicates, verified 35,200 stored rows, completed 222 queries, and reported no request errors. This only verifies the runner; the existing longer benchmark measurements remain unchanged. The client chunk is now 924.06 kB (283.27 kB gzip); Vite's size warning remains.

Production deployment, Cloudflare policy enforcement, and Docker startup were not re-tested. Browser delivery remains best effort; ordinary fetch cannot outlive page unload. No long-running performance claim is added by this review.

## Project sources — 2026-11-01

The final **60-test Chromium suite passed in 3.3 minutes** against the final API under Tako HTTPS. Two new browser tests cover source creation/editing, source-bound website/mobile keys, combined metrics, numeric sums scoped to a source, source grouping, remembered selection, stable renamed-source links, invalid source links without fallback queries, mobile-source defaults, and 390 px Settings/Explore layouts. A catalog failure after source creation is injected to verify retry does not create a second source. Existing privacy, theme, chart, realtime, loading, and stable-refresh checks also pass. An early source-count test assumed an order for tied groups; it now verifies both names without assuming UUID order. The multi-step source workflow has a 60-second overall test budget.

The **21 Rust tests** include two new source/migration tests: independent source credentials, source filters and numeric totals, project-wide retry deduplication, rejected source-ID overrides and cross-project references, case-insensitive duplicate names, source renaming, isolated key revocation, and migration of a real pre-source SQLite/DuckDB layout across repeated opens. `cargo test --all-targets`, strict all-feature Clippy, the release build, 16 Bun tests, format checks, typecheck, lint, and the production dashboard build pass. The client retains the existing large-chunk build warning (925.79 kB minified / 283.92 kB gzip).

The local API was stopped before a full data-directory backup, then restarted for the additive migration. The original Orbit website and CLI counts remained **7,236** and **3,694**, including after a second API restart. The combined Orbit demo contains **14,624 events across Website, iOS app, and CLI sources**. A repeated seed committed zero new events in all three sources. Browser inspection covered combined Overview, mobile and CLI defaults, source Settings, and the narrow Settings screenshot.

An immediate post-restart test setup encountered controlled 503 ingestion responses while startup retention swept the accumulated local project files. The final suite ran after that sweep completed. `/health` reports process health; it is not a promise that ingestion cannot encounter backpressure. Retry semantics still apply during maintenance. The [source-schema benchmark](benchmark.md#project-source-schema-follow-up--2026-11-01) measured 13,721 committed events/sec and 107.1 ms query p95 on the shared development host; its explicit workload and concurrency limitations are recorded there.

Source deletion/merging and native Swift/Kotlin SDKs are not implemented; mobile has HTTP examples. Retention and optional identity remain project-scoped. This update was not deployed to production. Pre-source binaries require restoration of the complete pre-upgrade backup to write again; this is documented in the API migration notes.


## Ephemeral refresh channels — 2026-11-01

Piko now pins JavaScript SDK `0.0.0-9ae824f` and declares `ephemeral: true` for refresh hints. The local CLI and shared dev daemon were upgraded to the matching release. A real two-subscriber test verifies live UUID-only messages with empty IDs, no disconnected-history replay, and successful reconnection with an old durable cursor. A separate test commits CLI events between the initial Explore query and first subscription, proves their hint was already published, then verifies explicit refresh recovers the database total. Existing reconnect, duplicate, project-scoping, and stable-refresh tests remain.

The first transport check caught the old daemon still issuing durable IDs after an app-only restart. After replacing the daemon, metadata requests exposed a Vite host-allowlist mismatch. Piko explicitly allows its internal `piko.tako` hostname; the registry still rejects requests without the runtime token with HTTP 403. No Tako source was changed. The restarted combined Orbit preview remains at **14,624 events** and shows **Live**.

A full browser run also exposed three transient query-capacity responses during navigation and refresh. Queries now honor one short advertised `Retry-After` delay, with cancellation and no mutation retries. Four new Bun tests verify payload preservation, bounded retries, cancellation, and mutation behavior; the three affected browser cases passed when rerun after the fix.

The final **61-test Playwright suite passed in 3.7 minutes** against the upgraded local Tako hosts. `bun fmt`, `bun fmt:check`, `bun typecheck`, `bun lint`, all **20 Bun tests**, and the production build pass. The existing client chunk warning remains (925.98 kB minified / 284.03 kB gzip). Rust source, database schemas, ingestion acknowledgment semantics, and the prior benchmark are unchanged; Rust checks and the benchmark were not rerun for this dashboard/SDK change. Production deployment and Cloudflare policy enforcement were not tested. Ephemeral channels currently require one Tako server without a shared Postgres credential.


## Server-rendered workspace — 2026-11-01

The root route had disabled SSR, which replaced the entire workspace with a generic placeholder until JavaScript loaded. The server now renders the navigation, toolbar, select labels, and footer. A local preference script reserves the saved collapsed rail before first paint, without adding cookies. Explore padding is route-based, the scrollbar gutter is stable, and catalog failures retry inside the existing frame. JavaScript-dependent controls remain disabled until hydration; theme state lives in the hydrated root route.

The full-page fake-card placeholder is replaced with a quiet workspace status. Metrics, charts, tables, and key lists retain their local loading states, while refresh preserves existing results. Following [Skullet's fast-response behavior](https://skullet.lochie.me/docs#reveals), placeholders wait 150 ms before appearing, without delaying available data. Reduced-motion stays static. Skullet is a reference, not a new dependency. Workspace data still loads in the browser so project and sidebar preferences remain local.

Thirteen new browser tests hold application scripts while inspecting the actual server HTML, then release hydration. They verify all three routes at 1440 px with expanded/collapsed rails, 894 px, and 390 px: unchanged main-content horizontal position and width, unchanged content origin, retained toolbar DOM, populated date controls, no hydration errors, and enabled interactions after hydration. A catalog outage verifies navigation remains usable and retry recovers in place. The existing server-response test now checks real navigation instead of a full-page skeleton.

Production verification also caught a rolling range anchored to the time Settings opened: newly committed source events were excluded when navigating to Overview without realtime. Navigation now advances that rolling interval before the new view starts querying; explicit drilldown intervals remain fixed. The mixed website/mobile source test now disables live hints to cover this case directly.

The final compiled standalone dashboard passed **67 browser tests in 1.7 minutes**; its seven channel-only tests are intentionally skipped because standalone mode reports live=false. All **14 realtime, refresh, and source tests passed in 1.0 minute** against the native Tako apps, including those seven channel cases. Together these cover every test in the 74-case suite. In-app browser inspection covered the initial server-rendered frame and loaded Overview/Explore; delayed-hydration screenshots cover desktop and mobile.

Final checks pass: bun fmt, bun fmt:check, bun typecheck, bun lint, all **20 Bun tests**, and bun run build. The existing large-client-chunk warning remains. Rust and the ingestion benchmark are unchanged and were not rerun. No production deployment was performed.


## Source icons and shared analytics — 2026-11-01

Source and project types are removed from the catalog, management payloads, and dashboard. Every source uses the same four metrics, event chart, and breakdown choices. Overview totals include custom events alongside page views and commands. Optional visitor, installation, and generic actor identities remain distinct; icons never affect queries, identity, or ingestion. Settings offers eleven Hugeicons choices plus Automatic, inferred locally from the name. Explicit choices survive renaming; Automatic follows the new name.

Catalog schema 3 migrates existing sources in one transaction, preserving their IDs, names, keys, and event attribution. The migration test covers the previous typed-source schema, key resolution, foreign-key integrity, and repeat startup after pinning an icon. Existing pre-source migration and crash-recovery tests also pass. Before upgrading the running local API, a complete backup was saved under `.tako/backups/pre-source-icons.CrtvSy/`. A fixed-range query before and after the upgrade returned the same **14,624 Orbit events**, and all three source IDs were unchanged. No analytics database rewrite is needed. Older management clients must stop sending `kind`; downgrade requires the pre-upgrade backup, as documented in [the API migration notes](api.md).

Checks pass: `bun fmt`, `bun fmt:check`, `bun typecheck`, `bun lint`, all **22 Bun tests**, `bun run build`, all **22 Rust tests** (`cargo test --locked -p piko`), strict Clippy, and `git diff --check`. New browser coverage verifies automatic inference, manual overrides, save/reload, renames, source-scoped collection, custom-event totals, and unchanged metric structure after a source name changes.

The compiled standalone dashboard passed **68 browser tests in 1.6 minutes**, with seven native-channel cases intentionally skipped. The native Tako run covered all seven channel cases plus refresh, SSR geometry, and sources: 26 passed initially; a hot-reload workspace error and a transient mobile-width assertion passed their targeted rerun after editing stopped. Together these runs cover every case in the **75-test suite**. The final select-alignment change was rebuilt and covered by the native checks. In-app browser inspection confirmed the Website and CLI overview layouts, automatic icons on the existing sample sources, and the icon picker at 390 px.

The existing client-chunk warning remains (933.98 kB minified / 286.62 kB gzip). No new benchmark was run: analytical storage and query execution are unchanged, and prior measured results remain in [the benchmark report](benchmark.md). Production deployment, Docker startup, and Cloudflare policies were not re-tested.


## Yuzu visual system — 2026-11-01

Implemented the user's selected Yuzu direction across Overview, Explore, Settings, and shared shadcn controls. Butter-yellow navigation, warm ink, a dedicated ochre chart token, self-hosted Geist, squared controls/badges, underline toolbar selectors, solid navigation selection, and straight chart segments replace the previous pine/Public Sans treatment. The upright three-bar logo and favicon reference the same versioned SVG asset. Geist's SIL Open Font License ships with the application. Product behavior and analytics queries are unchanged.

The full native Tako Chromium suite passed **75 tests in 4.8 minutes**, including Light/Dark/Auto persistence, narrow layouts, source icons, event inspection, live updates, stable refresh, and SSR shell geometry. `bun fmt`, `bun fmt:check`, `bun typecheck`, `bun lint`, all **22 Bun tests**, `bun run build`, and `git diff --check` pass. Compiled favicon and font-license files match the public source assets.

In-app browser inspection covered light/dark Explore, desktop Overview and Settings, and 390 px Explore/Settings. An independent Impeccable finish review found no material corrections. The recorded design system and schema-v2 sidecar now describe Yuzu; frontmatter nesting and token references were validated. DESIGN.md has a narrow formatter override because the current Markdown formatter flattens its nested YAML frontmatter. Its structure and token values are validated directly. Checked color pairs pass contrast thresholds: normal text at least 5.77:1 in Light and 7.56:1 in Dark, input outlines at least 3.61:1, and plotted lines at least 4.50:1. These measurements are for the checked semantic pairs, not a full accessibility certification.

The existing client chunk warning remains (933.67 kB minified / 286.51 kB gzip). Rust, storage, collectors, deployment configuration, and the benchmark are unchanged; their checks were not rerun for this visual change. No production deployment was performed.

## Yuzu theme refinement — 2026-11-01

Following the user's brightness and tint feedback, the Light workspace now uses soft stone surfaces and a muted yellow rail. Dark uses deeper, nearly neutral charcoal surfaces and neutral text; yellow remains in primary actions, charting, and the shared logo. Semantic tokens, DESIGN.md, the design sidecar, product context, and the surface brief agree. Layout, typography, logo assets, loading behavior, and backend behavior are unchanged.

Reviewed the rendered Settings and Explore pages in both themes at 1280 px, a Light source dialog, and the Dark Overview at 390 px. No horizontal document overflow was observed. Checked semantic text pairs have a minimum contrast of 4.55:1 in Light and 5.50:1 in Dark; checked input/data pairs exceed 3.30:1. These are targeted contrast measurements, not a complete accessibility audit. The Impeccable detector reported existing Geist and type/radius advisories outside this palette-only scope; the pinned typography and compact geometry remain.

Six focused Chromium checks pass against the native Tako apps: mobile website/tool layouts, sidebar persistence and keyboard controls, Light/Dark/Auto behavior, saved-theme application, mobile navigation/selects, and narrow Dark tool drilldowns. Two existing assertions were updated from the old olive background to the new charcoal background. Bun formatting, typecheck, lint, all 22 unit tests, and the production build pass. The existing client chunk-size warning remains. Rust tests and the ingestion benchmark were not rerun for this CSS/documentation change. No production deployment was performed.

## Official Bklit UI charts — 2026-11-01

Superseded by the TanStack Charts migration below; this section records the earlier verification.

Overview and Explore now use the official Bklit UI area chart, grid, axes, and tooltip components installed from `https://ui.bklit.com/r/{name}.json` through the Bun-run shadcn CLI. The committed registry sources and lockfile pin this installation; the MIT notice is included and served locally. Recharts and its unused shadcn wrapper are removed. Piko's existing utility module and Yuzu palette are preserved. Registry chart roles reference the existing theme tokens.

The shared adapter retains UTC dates, partial-bucket labels, metric units, responsive height, honest empty/loading/error states, and existing results during refresh. It adds keyboard inspection through the same crosshair and tooltip, with live value announcements. Narrow local adaptations to the official sources preserve missing-value gaps and zero baselines for negative aggregates, and permit vertical touch scrolling and pinch zoom. Those adaptations are documented beside the sources.

Two new Chromium regressions cover rendering gaps, zero/negative values, keyboard traversal/dismissal and UTC labels in a non-UTC browser, plus reduced-motion mobile layout and a real touch swipe across the chart. Existing metric and realtime tests now target the Bklit renderer. **All 77 Chromium tests passed in 4.9 minutes** against native Tako, including live ephemeral notifications, stable refresh, server-rendered shell geometry, source flows, privacy, themes, and mobile layouts. All **22 Bun tests** pass; formatting, lint, typecheck, and the production build pass. Manual browser inspection covered Overview's keyboard tooltip, Explore in both themes, and 390 px layout with no document overflow.

The measured main client bundle is **865.87 kB minified / 279.40 kB gzip**, compared with 933.67 kB / 286.50 kB before this migration. This is a build-size comparison, not a runtime performance benchmark. The existing chunk-size warning remains. Rust/storage/ingestion behavior is unchanged, and backend tests and the ingestion benchmark were not rerun. No production deployment was performed.

## Browser-test isolation and fixture cleanup — 2026-11-01

The previous browser-test command targeted the preview's persistent database and never removed its fixture projects. Local cleanup removed **798** confirmed browser-test, recovery-test, and duplicate CLI-verification projects, leaving the four demo projects plus the latest Rust CLI example. Before mutation, the API was stopped, its directory lock was acquired, and SQLite was backed up. Removed project databases and a manifest were archived under the ignored `.tako/backups/e2e-cleanup-20261101T141534Z/` directory. Retained management rows and analytics-file hashes were unchanged; SQLite integrity and foreign-key checks passed. The API was restarted and the five-project selector was verified in the browser.

`bun test:e2e` now owns dedicated Tako test apps and a fresh per-run database directory. Config guards reject direct preview-targeting Playwright runs, a preflight rejects nonempty test databases, and a lock blocks concurrent runs. Teardown stops the test apps before removing databases and generated configs. It restores existing Tako app registrations if initial test TLS setup reloaded the daemon. No API/storage implementation or Tako source was changed.

Validation: **77 Chromium tests passed in 3.6 minutes** using the isolated apps, including realtime tests. **24 Bun tests / 124 assertions**, `bun fmt`, `bun fmt:check`, `bun lint`, `bun typecheck`, and `git diff --check` pass. An intentional no-tests failure exited 1 and cleaned up; a separate run sent SIGTERM after a fixture test passed, exited 130, and cleaned up. A second concurrent runner was rejected before app startup. The preview's complete project/source API response was unchanged during and after the suite. Test-app registrations, temporary configs, databases, and the runner lock were absent after teardown; the two preview apps remained running.

Rust tests, the production frontend build, and the benchmark were not rerun for this test-infrastructure change. SIGKILL and machine shutdown cannot execute teardown; such remnants remain isolated and the recovery procedure is documented in `docs/tako.md`.

## Shadcn Base UI migration — 2026-11-02

Migrated the dashboard’s Select, Sidebar, Sheet/Dialog/AlertDialog, menus, tooltips, Collapsible, Tabs, Button, Badge, Input, Label, and Separator primitives to the official shadcn Base UI registry. `components.json` now uses `base-vega`; `@base-ui/react` replaces Radix, with no Radix packages left in the lockfile. Existing Yuzu styling, Hugeicons, cookie-free sidebar persistence, server-rendered labels, and Bklit charts remain.

New browser coverage exercises select typeahead, Enter/Escape and focus restoration, nested selects inside dialogs, dialog focus containment, repeated appearance selection, navigation link semantics, and the active sidebar highlight. Existing checks caught and resolved select-induced page scrolling, interaction with chart controls during initial loading, outgoing tab panels appearing together, and transient chart overflow during viewport resize. The realtime test now waits for the inspector’s closing animation before measuring refresh geometry; its stable-layout assertions are unchanged.

**79 Chromium tests passed in 3.2 minutes** against the isolated Tako test apps. After the final sidebar state-selector correction, all **5 affected keyboard, theme, sidebar, and mobile checks passed**. **24 Bun tests / 124 assertions**, formatting, lint, typecheck, and the client/SSR production build pass. Manual browser inspection covered the source picker, both themes, mobile Settings and navigation, and the active page highlight. Test teardown removed its temporary apps/databases. The native preview API required a clean restart after an orphaned process retained its directory lock; its five retained projects were confirmed afterward.

The measured main client chunk is **933.04 kB minified / 303.40 kB gzip**. The existing Vite chunk-size warning remains; this is a build-size measurement, not a performance benchmark. Rust, ingestion, and storage code are unchanged; backend tests and the ingestion benchmark were not rerun. No production deployment was performed.

## Select scrollbar stability — 2026-11-02

Dashboard value pickers now use Base UI’s supported `modal={false}` option. Opening a selector keeps the document scrollbar visible and leaves page scrolling available. An enclosing dialog still owns its modal scroll lock and focus containment.

The added regression failed before the fix because an open selector blocked wheel scrolling. All **5 focused browser checks** then passed, covering unchanged gutter/content geometry on opening and closing at 1440, 894, and 390 px, wheel scrolling, keyboard selection, Escape/focus restoration, and a nested select inside a dialog. In the native preview, the document client width previously changed from **1265 to 1280 px** when opening a select; after the fix it stayed **1265 px** before opening, while open, and after closing. Main-content position and width also stayed unchanged, with the scrollbar visibly present.

`bun fmt`, `bun fmt:check`, `bun typecheck`, `bun lint`, **24 Bun tests / 124 assertions**, and the production build pass. The existing bundle-size warning remains. The full browser suite and backend checks were not rerun for this scoped change. Tests used the isolated Tako apps and their disposable databases.

## Website origins and project favicons — 2026-11-02

Added optional per-key origin policies, with scheme/port-aware exact matches and subdomain wildcards, editable policies, and rejection before persistence. Existing keys migrate to unrestricted policies. Tests cover wildcard boundaries, missing/malformed origins, native clients, cross-project edits, retries, restart persistence, and the real browser-to-dashboard-to-API path.

Optional project websites now feed a server-fetched, locally cached favicon in the project selector. Tests cover website normalization, private/special IP rejection, bounded downloads, redirect rejection, cached bytes and headers after restart, project isolation, clearing/invalidation, late-fetch protection, first-party image requests, and geometry-preserving rendering fallback. The UI image test uses a fixture; a separate opt-in HTTPS smoke test successfully downloaded the actual Datafast favicon in 0.27 seconds. This is a single connectivity check, not a performance benchmark.

**31 Rust tests**, **30 Bun tests**, and **7 affected Chromium browser tests** passed, along with formatting, TypeScript, lint, Clippy with warnings denied, and the production build. The opt-in network smoke test passed separately. Browser checks used disposable Tako apps/databases, which were removed afterward. Manual review covered Dark desktop Settings and the origin editor, plus the Light mobile screenshot. The running preview API was restarted on the new binary; its five existing projects migrated successfully, and the origin editor was verified against that API without changing existing key policies. The full browser suite and mixed-load benchmark were not rerun; no production deployment was performed.


## TanStack Charts — 2026-11-02

Overview and Explore now use the native React/SVG adapter from `@tanstack/charts` 1.1.0. Removed the vendored Bklit runtime, registry entry, license notice, chart-theme tokens, and unused direct D3, Motion, and Number Flow dependencies. D3 dependencies owned by TanStack Charts remain transitive. Current integration details live in [charts.md](charts.md).

The adapter preserves linear segments, null gaps, measured zeroes, negative values, UTC calendar labels, partial-period tooltips, duration units, and stable refresh geometry. Native focus and tooltip announcements replace the old custom keyboard cursor; a small interaction-controller hook preserves Escape dismissal for unpinned tooltips. Automatic margins prevent hourly/monthly endpoint labels from clipping, including at 390 px. Native plot and tooltip animations are disabled.

Manual browser review covered Website and CLI sources, p95 duration, monthly partial periods, pointer/keyboard inspection, light/dark Explore, narrow-screen layout, and a stable Overview refresh. The preview was reloaded after the production build refreshed Vite's development module graph. Preview data was not changed. Browser tests use the disposable Tako apps and databases; the mobile test helper now waits for the sidebar's closing transition before choosing a project.

Formatting, typecheck, lint, **30 Bun tests / 141 assertions**, and the client/SSR production build pass. All **34 focused chart, overview, and dashboard browser checks** passed after the endpoint-label and mobile-test fixes. The final full suite passed **93 Chromium tests in 4.0 minutes**, and teardown removed both test apps and their temporary databases. Rust/backend checks and the ingestion benchmark were not rerun because the API, SDKs, and persistence logic are unchanged. No production deployment was performed.

The largest client chunk measures **569.47 kB minified / 189.05 kB gzip**. The existing Vite chunk-size warning remains. This is a build-size measurement, not a runtime performance benchmark.
