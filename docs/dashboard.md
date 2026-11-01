# Exploring from the overview

Select a product and date range in the header. Website overviews show page views. Tool overviews show command executions. Generic products include every event name and source.

Click a page, command, event, referrer, or other breakdown row to open its matching events in Explore. Each link carries the product, exact UTC interval, and selected value. It works after reload and through browser history, even when the browser previously had a different product selected.

Explore shows the linked interval and applied filters. Use its query controls to change the measure, grouping, or filter. Those edits apply to the current view; reloading the URL restores the original clicked selection. Clear the drilldown to return to the normal date range. Selecting another product or date range also clears the linked selection. A missing product or malformed drilldown shows an error instead of querying another product.

## Breakdown dimensions

- **Websites.** Switch the source card between referrers, UTM sources, and campaigns. These use `referrer`, `utm_source`, and `utm_campaign` properties from the browser tracker.
- **Developer tools.** Switch the environment card between operating systems, application versions, and architectures. These use `os`, `version`, and `arch` from the CLI example.
- **Generic products.** Explore event names and collection sources directly.

The count and percentage describe the selected row's share of all matching events. Percentages use the full result count, including groups outside the top 12. They are event shares, not visitor shares.

Values retain their property types. Boolean `true`, number `42`, and string `"42"` remain different filters. A row labeled “Not provided” has no drilldown because missing-property predicates are not supported yet.

All dates and buckets use UTC. A linked interval is fixed at the moment the row was clicked. Refresh reruns that interval. The end is exclusive, and today's bucket may be partial.

## Design notes

The [Datafast demo](https://datafa.st/demo) and its [filter documentation](https://datafa.st/docs/datafast-filters) informed the actionable breakdown rows and dimension tabs. Piko applies these ideas to both websites and developer tools using its existing event queries.

Period comparisons remain a future feature. They need explicit partial-day alignment and a query shape that avoids fetching unused event pages for comparison summaries.

## Event stream

The stream shows the newest events first, using event time in UTC. Website rows surface paths and referrers. Tool rows surface commands and versions, with success and duration shown when those properties have the correct boolean and numeric types. Anonymous events stay anonymous; visitor and installation identities remain distinct.

Open an event to inspect it in a side panel. Properties are searchable by name and value and include their original scalar type. Metadata shows event and receipt times, IDs, source, and optional identity/session details. The JSON tab exposes the complete event envelope. Copy actions copy JSON representations, so a string such as `"42"` remains distinct from the number `42`.

Use a property's filter action to run a matching query. This replaces the current property filter, preserves the applied event/source/measure/grouping, and resets pagination. Unsubmitted query-builder edits are not applied by that action.

Choose 15, 30, or 50 rows per page. Filtering and pagination happen on the server. While a page loads, charts stay visible and loading rows replace the previous page. The inspector's newer/older controls move only through the loaded page. There is no automatic live refresh.

The [PostHog Activity interface](https://posthog.com/docs/activity) informed the useful event context and separate property, metadata, and JSON views. Piko uses its existing event model and bounded server queries.

## Loading and feedback

Navigation stays available while the product catalog loads. Overview and Explore use placeholders shaped like their metric cards, charts, breakdowns, and event rows. Breakdown tabs load within their own card. Changing a product or query replaces the previous results with placeholders; pagination keeps the matching charts visible while its event rows load.

Refreshing the current view keeps its cards, charts, event rows, inspector, and page number visible. Only the activity icons change while new data loads; a failed refresh leaves the last results available with retry feedback. New products, date selections, or applied queries still use placeholders so unrelated results are never mislabeled. The fixed-size refresh action in the query header also announces new data from the live channel without adding or removing a banner.

Refresh and Run query indicate request activity and prevent duplicate submissions. Settings shows key-list loading separately from an empty list or a failed request. Create, save, and revoke actions show their active operation. A failed key revocation explains the failure inside its confirmation dialog.

A newly created key remains available to copy if refreshing the key list fails. Retrying the list does not create another key. If product creation succeeds but refreshing the product selector fails, Retry loading product fetches the catalog without submitting another creation request.

Placeholders follow the selected theme and respect reduced-motion preferences. Route placeholders have no minimum display duration, so a ready page is shown immediately.


## Interface icons

Piko uses the free Stroke Rounded set from [Hugeicons](https://hugeicons.com/), rendered with `@hugeicons/react`. Import named icon data from `@hugeicons/core-free-icons` and pass it directly to `HugeiconsIcon`. Navigation, metric cards, controls, and installed shadcn primitives share this set. `apps/dashboard/components.json` also selects `hugeicons` for future generated components.
