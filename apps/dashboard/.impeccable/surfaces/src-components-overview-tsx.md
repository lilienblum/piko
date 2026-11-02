---

version: 1
slug: "src-components-overview-tsx"
primary_target: "src/components/overview.tsx"
related_targets: ["src/components/overview-widgets.tsx", "src/components/date-range-picker.tsx", "src/components/shared.tsx", "src/lib/date-range.ts", "src/lib/time-buckets.ts", "src/lib/workspace-search.ts", "src/lib/report-link.ts", "src/styles.css"]
---

# Piko Overview

Scope: Overview, shared report dates, and report-row actions. Mode: extend the existing Kanagawa Wave world.
Audience: developers checking combined project activity or one website/CLI source before investigating events.
Authority: the user selected the Plausible-style compact metrics, wide chart, and paired reports, then clarified that metrics are **small squares, iOS style**. This replaces the earlier equal-size chart-widget grid, source summary strip, donuts, and separate duration chart without changing the palette or creating a new visual concept.

## Direction contract

THESIS: one reporting-period decision and easy-to-scan activity lead from scope to useful evidence.
OWN-WORLD: retain Kanagawa Wave sumi-ink surfaces, warm text, orange actions, yellow/violet/aqua chart accents, green outcomes, Geist, Hugeicons, and accessible shadcn Base UI. Small metric squares are flat with softly rounded corners; report containers remain flat rectangles.
STORY: choose project/source and date, scan metrics, inspect the trend, filter reports in place, then use an independent external-link action or View matching events for Explore inspection.
FIRST VIEWPORT: six small square metrics precede one wide Activity chart and paired reports. Narrow layouts preserve this reading order; the reports continue below the chart.
FORM: the user-selected Plausible and iOS references guide composition within the incumbent world. No random concept seed or new visual identity applies.

## Built hierarchy

1. **Metric squares:** Active now, Events, Visitors, Installations, Success rate, and Avg. duration. Active now queries distinct identified actors over the last five minutes independently of report dates, retaining project/source/filter scope. Other metrics describe the selected period. Identity remains opt-in; anonymous events count toward activity. Visitors and installations stay distinct. Outcomes count boolean success values and duration counts numeric values only.
2. **Activity over time:** one full-width TanStack line/area chart with the selected measure, metric selector, UTC bucket labels, and partial-period note. It is the only Overview time-series region.
3. **First report pair:** Breakdown always occupies the first slot, including while source data resolves. The second slot is Sources when multiple sources contribute matching events, otherwise Identified actors. Sources use ranked bars, exact counts, and shares; synthetic Other sources is not a drilldown. Identified actors retain separate visitor/installation/other counts, optional identity language, and website sessions when present.
4. **Second report pair:** Success rate uses labeled success/failure values and bars. Duration offers Average/p95 selection, both exact measures, and comparison bars. It has no separate time-series plot. Missing outcomes or durations have explanatory empty states.

Breakdown defaults to event names. Sources, clients, pages, commands, referrers, campaigns, screens, versions, OS, and architecture remain available. Website and CLI data receive equally capable workflows.

## Geometry and color

Metric tiles have a 1:1 aspect ratio at every width, 16px padding, 16px corners, a fine semantic border, and the card surface. Their grid has six columns, three at container widths up to 870px, and two up to 550px. Gaps are 12px with 24px below the metric strip. These small squares are the user-requested silhouette; chart/report containers are not square.

Activity spans the report grid at 430px high, becoming 350px at container widths up to 550px. Reports are 300px high in two columns with 20px gaps, becoming one column at 550px. Report padding is 20px, then 16px at the narrow breakpoint; corners retain the existing 12px radius. Steady headers, flexible bodies, and reserved footers keep local results and messages from moving surrounding sections. Widget headings use 14px/600; tabular measurements retain the existing compact Geist hierarchy.

Keep Carp Yellow chart strokes, subtle area fills, sparse axes, and linear interpolation. Proportional report bars sit behind labels with exact measures alongside. Success/destructive colors retain outcome semantics. No source summary strip or Overview donut remains.

## Dates and aggregation

One outlined date trigger opens a preset/custom-range popover. Presets include Today, Yesterday, Last 7/30/90 days, This month, Last month, This year, and Last 12 months. Applicable previous/next arrows move calendar days, months, years, or fixed ranges; unavailable future steps are disabled. Rolling 7/30/90-day and 12-month periods do not show stepping arrows.

Custom range switches within the same popover to calendar and date inputs: two months on desktop, one on mobile, inclusive UTC calendar days, and at most 366 days. Apply range commits; dismissal discards drafts. Keep the popover nonmodal and avoid scrollbar/layout shifts.

Buckets derive automatically from the selected duration: up to two days hourly, up to 31 days daily, up to 180 days weekly, otherwise monthly. Weeks begin Monday and all chart/calendar labels stay UTC. There is no manual interval selector; legacy interval URL state is ignored.

## Filtering and external links

Report rows filter Overview in place. Validated URL state carries one string, number, or boolean filter alongside source scope. Source rows change source scope; the visible applied-filter action clears the filter. View matching events opens Explore with the current scope, period, and filter. Invalid filters show an explicit unavailable-filter state rather than silently changing scope.

Supported page/referrer rows expose a separate external-link icon on hover or keyboard focus, always visible on touch. Page paths resolve against the configured website origin; referrers require a valid supported destination. Only HTTP(S) URLs are eligible, with credentials and unsafe inputs rejected. Links open separately with noopener and noreferrer. The external action never replaces the row's filter action.

## States and verification

Keep shell, chart, reports, and unchanged-scope results mounted during refresh. Use installed Skullet text/box placeholders only within pending regions; changed scope must not relabel old data. Errors remain local with Retry, and empty ranges retain meaningful controls and explanations. Preserve keyboard chart inspection, focus, touch scrolling, and reduced-motion behavior. Active now is a live identified-actor measure, not an estimate inferred from IP or user agent.

Reference screenshots: `/tmp/piko-overview-1440.png` and `/tmp/piko-overview-390.png`, captured with synthetic fixtures. Review confirmed reference fidelity and required Breakdown's stable first position during source resolution; that correction is implemented. Screenshots are validation artifacts, not product assets or customer evidence. Explore and Settings keep their established compositions; no new collection or backend feature is implied.
