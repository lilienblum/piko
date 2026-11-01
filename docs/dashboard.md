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
