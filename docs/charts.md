# Charts

Overview and Explore use **TanStack Charts 1.1.0** (`@tanstack/charts/react`). The shared adapter is `apps/dashboard/src/components/analytics-chart.tsx`. It renders the server's query buckets; it never re-aggregates or interpolates missing measurements.

- Native SVG line and area marks use straight segments and a zero baseline, including negative values. Null numeric values break the line and area; measured zero remains zero. A single valid point has a visible marker.
- X coordinates are UTC epoch milliseconds. Tick labels use actual bucket timestamps and explicit UTC formatting, including weekly/monthly buckets and partial-period tooltip labels. Duration axes and tooltips include `ms`.
- The library handles responsive sizing, SSR, pointer/touch focus, keyboard navigation, tooltips, and accessible value announcements. Left/Right, Home/End, and Escape inspect or dismiss values. Invisible bucket targets make null values keyboard-accessible without drawing them as zero; the tooltip reports “No numeric value.”
- Escape also clears ordinary focus through TanStack's interaction controller because 1.1.0 only dismisses pinned tooltips itself.
- Existing CSS reserves the plot height before measurement. Refresh keeps the mounted chart and previous results. SVG and tooltip animations are disabled. Touch gestures can scroll the page across the plot.
- Chart colors and tooltips use Piko's semantic Light/Dark/Auto theme tokens. No separate chart palette, chart registry, or vendored chart runtime is needed.

Install with `bun install --frozen-lockfile`. Run the focused browser checks with:

```sh
bun test:e2e tests/analytics-chart.spec.ts tests/overview-chart.spec.ts tests/realtime.spec.ts
```

These run against disposable E2E apps and databases, not the preview. The checks cover gaps, zero/negative values, degenerate series, keyboard UTC inspection from a non-UTC browser, units on narrow layouts, reduced motion, touch scrolling, calendar intervals, and stable refresh.
