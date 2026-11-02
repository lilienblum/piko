---

version: 1
slug: "apps-dashboard-src-components-explore-tsx"
primary_target: "apps/dashboard/src/components/explore.tsx"
related_targets: ["apps/dashboard/src/components/overview.tsx","apps/dashboard/src/components/settings.tsx","apps/dashboard/src/components/app-shell.tsx","apps/dashboard/src/styles.css"]
---

# Piko analytics workbench

Scope: Overview, Explore, Settings and shared shell. Mode: Operate.
Audience: developers inspecting website/tool activity. Task: choose product/date, read measurements, refine a server-side query, inspect an event, and manage collection.
Constraints: preserve all behavior, privacy controls, keyboard navigation, themes, mobile layouts, and stable refresh geometry. No new backend scope or identity collection.
Direction: user-selected Yuzu from the eight-theme preview. Muted yellow navigation and stone surfaces in Light, deep charcoal in Dark, restrained yellow accents, ochre charting, Geist, squared controls, ink navigation selections and a straight three-bar mark. The user subsequently selected A — Compact workspace: project and source scope belong in a useful sidebar, followed by a wide chart with interval buttons and paired breakdowns. Preserve the Yuzu control treatment and existing analytics behavior.
Memorable moment: the muted yellow Light rail, charcoal Dark rail, and solid selection orient a continuous analytical workspace; charts and proportional bars share a crisp graphic vocabulary.
Composition: a 15rem sidebar holds projects, destinations, and sources; a 3.5rem collapsed rail and mobile drawer preserve the same destinations. The header holds current scope, dates, refresh, and appearance. Overview uses shared metric rows, a full-width chart with Hourly/Daily/Weekly/Monthly controls, and equal-width event/dimension breakdowns with aligned headers. Explore keeps its shallow query rail, two-thirds trend and one-third breakdown, and dense event stream. Reference: the Yuzu light/dark preview in piko-theme-directions.html; the user explicitly selected it. No further concept selection is needed.
Unresolved: none. Light, Dark and Auto remain supported, with no new backend or telemetry behavior.

Theme refinement: reduce glare on large Light surfaces; keep Dark surfaces and text nearly neutral. Yuzu yellow is an accent, not a tint applied to every surface. This refinement follows the user’s explicit feedback.

Chart implementation: official Bklit UI area charts now power Overview and Explore. Retain Yuzu tokens, the linear analytical treatment, UTC formatting, numeric gaps, keyboard inspection, and stable refresh geometry.
