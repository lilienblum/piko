# Exploring from the overview

Select a project, source, and date range in the header. **All sources** combines the project; a named source filters every metric, chart, breakdown, and event row on the server. Every source uses the same overview, includes all event names, and offers the same chart metrics and breakdowns. Source selection is remembered per project. Settings manages every source regardless of the analytics selection.

Click a page, command, event, referrer, or other breakdown row to open its matching events in Explore. Each link carries the project, selected source when applicable, exact UTC interval, and selected value. A source breakdown link uses its stable ID, so renaming does not break links. It works after reload and through browser history, even when the browser previously had a different product selected.

Explore shows the linked interval and applied filters. Use its query controls to change the measure, grouping, or filter. Those edits apply to the current view; reloading the URL restores the original clicked selection. Clear the drilldown to return to the normal date range. Selecting another project, source, or date range also clears the linked selection. A missing project/source or malformed drilldown shows an error instead of querying another product.

## Overview chart

Use the chart's metric and interval controls to ask a different question without opening Explore. Summary cards and breakdowns continue to describe the full selected period when the chart changes.

Every source offers event counts, identified actors, unique visitors, active installations, average duration, and p95 duration. Visitor and installation identities remain distinct. Summary cards show Events, Identified actors, Success rate, and Average duration; absent identities or properties are shown as unavailable, not invented zero values.

Daily buckets are the default. Hourly buckets are available for ranges of 31 days or less; longer ranges use daily buckets. Labels and bucket boundaries use UTC. The first or last bucket is marked partial when the selected range cuts through it. A partial bucket should not be interpreted as a complete day or hour.

Distinct identities are counted within each bucket. Adding daily visitor or installation counts does not give a unique count for the whole period. Duration charts include only numeric `duration_ms` values. Missing durations remain gaps; they are not zero-duration commands. When no matching identities or numeric durations are available, the chart explains what is missing.

Changing a chart selection loads only the plot while its controls, summary cards, and breakdowns stay in place. Refreshing an unchanged selection keeps the plotted results visible. Chart requests use the existing product-scoped query API; the default daily count view reuses the main Overview result.

## Breakdown dimensions

Top events always ranks event names. The **Breakdown** selector offers Sources, Clients, Pages, Commands, Referrers, Campaign sources, Campaigns, Screens, Versions, OS, and Architecture for every source. Property dimensions include all matching events; they do not silently restrict the event name. Missing values remain informational. Use Explore to explicitly filter an event, inspect typed properties, or choose other groupings.

## Source icons

Settings lets you name sources and choose an optional icon from Hugeicons. **Automatic** follows common platform words in the name (iOS, Android, website, CLI, API, desktop, mobile, SDK, code, game); unrecognized names use a cube. Choosing an icon pins it across renames. Return to Automatic to follow the name again. Icons appear in the source list and source selector and never change analytics behavior. Integration language tabs are available for every source and remain under your control.

## Design notes

The [Datafast demo](https://datafa.st/demo) and its [filter documentation](https://datafa.st/docs/datafast-filters) informed the actionable breakdown rows and dimension choices. Piko applies these ideas to both websites and developer tools using its existing event queries.

The [Plausible live dashboard](https://plausible.io/plausible.io) and its [dashboard tour](https://plausible.io/docs/guided-tour) informed chart metric selection, interval controls, and partial-period context. Piko uses chart-local controls so its existing summary metrics remain consistent across sources.

Period comparisons remain a future feature. They need explicit partial-day alignment and a query shape that avoids fetching unused event pages for comparison summaries.

## Event stream

The stream shows the newest events first, using event time in UTC. Website rows surface paths and referrers. Tool rows surface commands and versions, with success and duration shown when those properties have the correct boolean and numeric types. Anonymous events stay anonymous; visitor and installation identities remain distinct.

Open an event to inspect it in a side panel. Properties are searchable by name and value and include their original scalar type. Metadata shows event and receipt times, IDs, source, and optional identity/session details. The JSON tab exposes the complete event envelope. Copy actions copy JSON representations, so a string such as `"42"` remains distinct from the number `42`.

Use a property's filter action to run a matching query. This replaces the current property filter, preserves the applied event/source/measure/grouping, and resets pagination. Unsubmitted query-builder edits are not applied by that action.

Choose 15, 30, or 50 rows per page. Filtering and pagination happen on the server. While a page loads, charts stay visible and loading rows replace the previous page. The inspector's newer/older controls move only through the loaded page. There is no automatic live refresh.

The [PostHog Activity interface](https://posthog.com/docs/activity) informed the useful event context and separate property, metadata, and JSON views. Piko uses its existing event model and bounded server queries.

## Loading and feedback

Navigation stays available while the product catalog loads. Overview and Explore use placeholders shaped like their metric cards, charts, breakdowns, and event rows. Breakdown choices load within their own card. Changing a product or query replaces the previous results with placeholders; pagination keeps the matching charts visible while its event rows load.

Refreshing the current view keeps its cards, charts, event rows, inspector, and page number visible. Only the activity icons change while new data loads; a failed refresh leaves the last results available with retry feedback. New products, date selections, or applied queries still use placeholders so unrelated results are never mislabeled. The fixed-size refresh action in the query header also announces new data from the live channel without adding or removing a banner.

Refresh and Run query indicate request activity and prevent duplicate submissions. Settings shows key-list loading separately from an empty list or a failed request. Create, save, and revoke actions show their active operation. A failed key revocation explains the failure inside its confirmation dialog.

A newly created key remains available to copy if refreshing the key list fails. Retrying the list does not create another key. If product creation succeeds but refreshing the product selector fails, Retry loading product fetches the catalog without submitting another creation request.

Placeholders follow the selected theme and respect reduced-motion preferences. Route placeholders have no minimum display duration, so a ready page is shown immediately.


## Interface icons

Piko uses the free Stroke Rounded set from [Hugeicons](https://hugeicons.com/), rendered with `@hugeicons/react`. Import named icon data from `@hugeicons/core-free-icons` and pass it directly to `HugeiconsIcon`. Navigation, metric cards, controls, and installed shadcn primitives share this set. `apps/dashboard/components.json` also selects `hugeicons` for future generated components.

Mobile source overviews focus on events and explicitly identified actors, with screen, version, and OS breakdowns when those properties are provided. They do not show website visitor/session or CLI installation cards.

## Source management

Settings lists sources with their name and type. Add or edit a source there, then choose it in **Key source** before creating an ingestion key. Each key belongs permanently to one source. Integration snippets use the selected source's key; mobile sources start on the HTTP example. Renaming a source changes its display name without moving historical events. Sources share the project's retention policy and optional identity namespace. Revoke its keys to stop intake; source deletion and merging are outside v1.
