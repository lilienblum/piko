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
Direction: field-station measurement labels; pine ink and action, cool stone working ground, pale citron navigation, flat analytical surfaces, Public Sans, compact but readable controls.
Memorable moment: the query, trend, breakdown and start of the event stream form one continuous workbench instead of separate floating cards.
Composition: .impeccable/mocks/explore-a.png, selected under the user's delegated design choice. The existing single-series chart, anonymous/pseudonymous identity distinctions, three-stroke logo, and account-free shell take precedence over illustrative mock details. See .impeccable/direction-notes.md for the fidelity inventory and seed 1c47a4fc.
Unresolved: none for this iteration. Do not reinterpret this as a marketing identity or add ornamental botanical content.

First rendered review: the full-width query header consumed a row without adding a task. Removed the visible "Build a query" heading (retained as the form's accessible label) and placed "Refresh results" next to its count, preserving live-update behavior. This brings the event stream higher and matches composition A's shallow query rail. Count/actor charts omit the irrelevant numeric-property caveat. Tabs use their true line variant; the global border default now sits in Tailwind's base layer so it does not override transparent utility borders.

Finish review: preserve the shipped world and topology; improve desktop density. At widths above 1150px, reduce Explore's heading/result spacing and plot height to 180px, align source badges beside event names, and use 56px table rows with explicit identity/context metadata retained. Keep the mobile treatment. Remove the CardHeader's unused explicit second grid row so a single grouped heading does not reserve blank space. One final rebuild/capture follows this material-fix batch; no further aesthetic iteration.
