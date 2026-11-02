# Exploring from the overview

Select a project and source in the sidebar, and a date range beside the report heading. **All sources** combines the project; a named source filters every metric, chart, breakdown, and event row on the server. Every source uses the same overview, includes all event names, and offers the same chart metrics and breakdowns. The URL records the selected project, source, and date range; saved preferences only initialize a bare entry URL. Settings manages every source regardless of the analytics selection.

Click a page, command, event, referrer, or other breakdown row to open its matching events in Explore. Each link carries the project, selected source when applicable, exact UTC interval, and selected value. A source breakdown link uses its stable ID, so renaming does not break links. It works after reload and through browser history, even when the browser previously had a different product selected.

Explore shows the linked interval and applied filters. Use its query controls to change the measure, grouping, or filter. Running a query writes the applied configuration to the URL, so reloading or sharing it restores those changes. Unsubmitted edits stay local. Clear the drilldown to return to the normal date range. Selecting another project, source, or date range also clears the linked selection. A missing project/source or malformed drilldown shows an error instead of querying another product.

## Shareable URLs

Projects have stable, unique slugs. An example Overview link is `/projects/orbit?source=all&days=30&interval=week`. A renamed project keeps its slug. Explicit URL selections win over browser preferences; unavailable projects/sources and malformed scope parameters show an error instead of querying a fallback project. Links do not change access permissions.

- Project paths: `/projects/<slug>`, `/projects/<slug>/explore`, and `/projects/<slug>/settings`. Bare `/`, `/explore`, and `/settings` open the saved project and replace the URL with its canonical path.
- Shared query parameters: `source` (`all` or a source UUID), `days` (7, 30, or 90), and optional `snapshot` (an exact UTC ISO timestamp).
- Overview parameters: `metric`, `interval` (`hour`, `day`, `week`, `month`), `breakdown`, and `duration` (`avg` or `p95`).
- Explore parameters: `query` (TanStack Router's JSON-encoded applied configuration), `page` (one-based), and `pageSize` (15, 30, or 50). Typed filter text is preserved, including the difference between `42` and `"42"`.

**Pin dates** sets `snapshot` to the current range end and shows **Fixed dates**. The start is derived from `days` using UTC calendar days. Copy the address bar to share the same interval and report configuration. Choosing a rolling date range removes the snapshot. A snapshot pins the query interval, not the results: late arrivals and retention can still change counts. Existing Overview drilldown links retain their exact start/end timestamps.

Project/source/date context follows sidebar navigation. Each route owns its chart or query choices; browser Back/Forward restores them. Automatic updates never rewrite the URL or add history entries, and they preserve unfinished query drafts and pagination.

## Overview widgets

Overview is a collection of six square widgets, arranged in three, two, or one column as the available space changes:

- **Activity over time:** a selected measure and its time-series. Choose events, identified actors, visitors, installations, average duration, or p95 duration. The headline is the selected measure over the full range, calculated by the server.
- **Sources:** when only one source contributes matching events, show its exact event count, icon, name, and Explore link without a pie or redundant 100% label. For multiple contributing sources, show a donut with the three largest sources and an **Other sources** slice for all remaining events, including groups beyond the server's top-twelve response. The center uses a compact total; the footer and legend retain exact counts. Named sources link to their events in Explore.
- **Breakdown:** ranked rows with exact counts, shares, and drilldowns. Top events is the default; use the selector for another dimension. Longer lists scroll inside the widget.
- **Identified actors:** distinct identities, separate visitor and installation counts, other actor identities, and website sessions when available. Identity is optional; unidentified events still count toward activity.
- **Success rate:** succeeded/failed shares among events reporting a boolean `success` value. Missing properties and strings are excluded, and the absence of valid values is explained.
- **Duration:** average/p95 buttons, the overall duration in milliseconds, and a time-series. Only numeric `duration_ms` properties contribute; the overall percentile is calculated from raw events, never averaged from bucket percentiles.

The connected **Hourly / Daily / Weekly / Monthly** controls apply to both time-series. Daily is the default. Hourly is available for ranges up to 31 days; longer ranges fall back to Daily. Buckets and labels use UTC, weeks begin Monday, and months follow calendar boundaries. The chart notes when the first or last bucket is partial.

Distinct identities are counted within each bucket. Adding daily visitor or installation counts does not give a unique count for the whole period. Missing durations remain gaps; they are not zero-duration commands. When no matching identities or numeric durations are available, the widget explains what is missing.

Changing a measure loads only its value and plot; changing a breakdown loads only its rows. The six widget containers and controls stay in place. Refreshing an unchanged selection keeps existing values, plots, and rows visible; errors offer a local Retry action. Skullet placeholders occupy the affected regions for new ranges. Queries remain server-side and scoped to the selected project/source; default daily counts reuse the main result and the duration query runs only when numeric durations exist.

## Breakdown dimensions

The **Breakdown** selector offers Top events, Sources, Clients, Pages, Commands, Referrers, Campaign sources, Campaigns, Screens, Versions, OS, and Architecture for every source. Property dimensions include all matching events; they do not silently restrict the event name. Missing values remain informational. Use Explore to explicitly filter an event, inspect typed properties, or choose other groupings.

## Source icons

Settings lets you name sources and choose an optional icon from Hugeicons. **Automatic** follows common platform words in the name (iOS, Android, website, CLI, API, desktop, mobile, SDK, code, game); unrecognized names use a cube. Choosing an icon pins it across renames. Return to Automatic to follow the name again. Icons appear in the source list and source selector and never change analytics behavior. Integration language tabs are available for every source and remain under your control.

## Design notes

The [Datafast demo](https://datafa.st/demo) and its [filter documentation](https://datafa.st/docs/datafast-filters) informed the actionable breakdown rows and dimension choices. Piko applies these ideas to both websites and developer tools using its existing event queries.

The [Plausible live dashboard](https://plausible.io/plausible.io) and its [dashboard tour](https://plausible.io/docs/guided-tour) informed chart metric selection, interval controls, and partial-period context. Piko keeps metric and breakdown choices inside their widgets, with interval buttons shared by both time-series.

Period comparisons remain a future feature. They need explicit partial-day alignment and a query shape that avoids fetching unused event pages for comparison summaries.

## Event stream

The stream shows the newest events first, using event time in UTC. Website rows surface paths and referrers. Tool rows surface commands and versions, with success and duration shown when those properties have the correct boolean and numeric types. Anonymous events stay anonymous; visitor and installation identities remain distinct.

Open an event to inspect it in a side panel. Properties are searchable by name and value and include their original scalar type. Metadata shows event and receipt times, IDs, source, and optional identity/session details. The JSON tab exposes the complete event envelope. Copy actions copy JSON representations, so a string such as `"42"` remains distinct from the number `42`.

Use a property's filter action to run a matching query. This replaces the current property filter, preserves the applied event/source/measure/grouping, and resets pagination. Unsubmitted query-builder edits are not applied by that action.

Choose 15, 30, or 50 rows per page. Filtering and pagination happen on the server. While a page loads, charts stay visible and loading rows replace the previous page. The inspector's newer/older controls move only through the loaded page. New committed data updates the table automatically without resetting the selected page or inspector.

The [PostHog Activity interface](https://posthog.com/docs/activity) informed the useful event context and separate property, metadata, and JSON views. Piko uses its existing event model and bounded server queries.

## Loading and feedback

Navigation stays available while the product catalog loads. Overview uses local placeholders inside its six mounted widgets. Explore uses placeholders shaped like its results, chart, breakdown, and event rows. Breakdown choices load within their own card. Changing a product or query replaces the previous results with placeholders; pagination keeps the matching charts visible while its event rows load.

Refreshing the current view keeps its cards, charts, event rows, inspector, and page number visible. Updates run in the background; a failed refresh leaves the last results available with retry feedback. New products, date selections, or applied queries still use placeholders so unrelated results are never mislabeled. Live hints, reconnection, focus, and visible online polling keep analytics current without a manual refresh control.

Run query indicates request activity and prevents duplicate submissions. Settings shows key-list loading separately from an empty list or a failed request. Create, save, and revoke actions show their active operation. A failed key revocation explains the failure inside its confirmation dialog.

A newly created key remains available to copy if refreshing the key list fails. Retrying the list does not create another key. If product creation succeeds but refreshing the product selector fails, Retry loading product fetches the catalog without submitting another creation request.

Placeholders use the fixed Kanagawa palette and respect reduced-motion preferences. Route placeholders have no minimum display duration, so a ready page is shown immediately.


## Interface icons

Piko uses the free Stroke Rounded set from [Hugeicons](https://hugeicons.com/), rendered with `@hugeicons/react`. Import named icon data from `@hugeicons/core-free-icons` and pass it directly to `HugeiconsIcon`. Navigation, metric cards, controls, and installed shadcn primitives share this set. `apps/dashboard/components.json` also selects `hugeicons` for future generated components.

All sources share the same analytics interface. The optional icon is visual metadata; it does not change queries or infer identity.

## Source management

Settings lists sources with their name and icon. Automatic chooses an icon from the name; an explicit choice stays fixed after renaming. Add or edit a source there, then choose it in **Key source** before creating an ingestion key. Each key belongs permanently to one source. Integration snippets use the selected source's key; Browser, TypeScript, Rust CLI, and HTTP / Mobile examples are available for every source. Renaming a source changes its display name without moving historical events. Sources share the project's retention policy and optional identity namespace. Revoke its keys to stop intake; source deletion and merging are outside v1.

## Chart inspection

Overview and Explore use TanStack Charts. Hover or touch a time-series to inspect a bucket, or a donut to inspect a category. Exact donut values are also available in the legend. Keyboard users can focus the chart and use Left/Right, Home/End, and Escape; values are announced to assistive technology. Labels and tooltips use UTC regardless of the device timezone. Zero remains a measured zero, missing numeric values remain gaps, and negative numeric aggregates retain their sign. Touch scrolling remains available across the plot.

## Component foundation

Dashboard primitives use the official shadcn **Base UI** registry (`base-vega`) and `@base-ui/react`, with Hugeicons and Piko’s Kanagawa colors and existing compact control styles. Radix is not a dependency. Add or update components from the Base UI registry, merge local styling and behavior, and use `render` composition instead of `asChild`. Buttons rendering navigation links must retain link semantics.

`ValueSelect` uses Base UI’s non-modal mode so opening a picker leaves the page scrollbar and viewport unchanged. An enclosing dialog keeps its own scroll lock. It supplies value/label items for server-rendered labels and uses a fixed popup positioner so opening a selector cannot scroll the document. Initial chart loading disables its controls until the result is ready; background refresh keeps them mounted. Dialogs, mobile navigation, tabs, and the event inspector preserve keyboard navigation and focus restoration. The sidebar continues to store its preference without cookies.

## Appearance

Piko has one fixed Kanagawa Wave theme. Sumi-ink surfaces, warm text, orange primary actions, and yellow/violet/aqua chart accents are present from the first server-rendered paint. There is no appearance menu or theme preference, and old saved Light/Dark/Auto values are ignored.

The shared component theme defines foreground/background pairs, hover and pressed surfaces, selection, focus, radii, and elevation in `apps/dashboard/src/styles.css`. Component variants consume those tokens directly. Controls use 6px corners, cards 12px, fields a recessed surface, and segmented choices one shared frame. Menus and dialogs use soft shadows; keyboard focus uses a single yellow outline. Preserve these defaults when adding Base UI components instead of reintroducing generated dark-mode overrides or page-specific bevel styles.
