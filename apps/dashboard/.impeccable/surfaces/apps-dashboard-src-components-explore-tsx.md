---

version: 1
slug: "apps-dashboard-src-components-explore-tsx"
primary_target: "apps/dashboard/src/components/explore.tsx"
related_targets: ["apps/dashboard/src/components/overview.tsx","apps/dashboard/src/components/settings.tsx","apps/dashboard/src/components/app-shell.tsx","apps/dashboard/src/styles.css"]
---

# Piko analytics workbench

Scope: Overview, Explore, Settings and shared shell. Mode: Operate.
Audience: developers inspecting website/tool activity. Task: choose product/date, read measurements, refine a server-side query, inspect an event, and manage collection.
Constraints: preserve all behavior, privacy controls, keyboard navigation, the single theme, mobile layouts, and stable refresh geometry. No new backend scope or identity collection.
Direction: user-selected Kanagawa Wave with one fixed theme. Use sumi-ink surfaces, warm text, orange primary actions, and yellow/violet/aqua data accents. Preserve Geist, softly squared shared controls, the shared three-bar logo, existing layout, and analytics behavior.
Memorable moment: orange selection and warm measurements stand apart from a quiet sumi-ink workspace.
Composition: a 15rem sidebar holds projects, destinations, and sources; a 3.5rem collapsed rail and mobile drawer preserve the same destinations. Dates share the report heading grid; there is no separate top bar or connection/version footer. Settings holds the event timezone preference. Overview uses shared metric rows, a full-width chart with Hourly/Daily/Weekly/Monthly controls, and equal-width event/dimension breakdowns with aligned headers. Explore keeps its shallow query rail, two-thirds trend and one-third breakdown, and dense event stream. Reference: the Kanagawa Wave single-theme preview in piko-theme-directions.html; the user explicitly selected it. No further concept selection is needed.
Unresolved: none. Light, Dark and Auto remain supported, with no new backend or telemetry behavior.

Theme refinement: reduce glare on large Light surfaces; keep Dark surfaces and text nearly neutral. Kanagawa Wave yellow is an accent, not a tint applied to every surface. This refinement follows the user’s explicit feedback.

Chart implementation: official Bklit UI area charts now power Overview and Explore. Retain Kanagawa Wave tokens, the linear analytical treatment, UTC formatting, numeric gaps, keyboard inspection, and stable refresh geometry.

Loading refinement: use the installed Skullet package for measured text and component placeholders, with existing results retained during refresh. Navigation and controls remain server-rendered and stable.

Automatic freshness: Overview and Explore reconcile live hints, reconnects, tab returns, and a 30-second visible-tab interval. There is no routine refresh control. Existing content stays mounted, drafts and page selection persist, and an open event inspector retains its captured page while the newest-first table updates.
