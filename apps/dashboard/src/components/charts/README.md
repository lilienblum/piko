# Bklit UI charts

These are the official [Bklit UI](https://bklit.com) source components, installed on 2026-11-01 through the shadcn registry with Bun:

```sh
bunx --bun shadcn@latest add @bklit/area-chart @bklit/y-axis
```

Registry: `https://ui.bklit.com/r/{name}.json`. The committed sources and Bun lockfile pin this installation. The chart components are MIT licensed, copyright 2026 uixmat; the full notice is included at `apps/dashboard/public/licenses/bklit.txt` and served at `/licenses/bklit.txt`. Bklit Studio is not included.

Piko's integration is `../analytics-chart.tsx`. It maps chart roles to the existing theme, uses UTC labels, provides arrow-key inspection with live announcements, and preserves the fixed chart/loading geometry. Registry defaults are overridden through component props where possible.

Local adaptations to preserve analytics correctness and accessibility:

- `area.tsx`: missing/non-finite values break the line and fill; numeric zero is retained. Area fills use the zero baseline.
- `y-domain-utils.ts`: include zero in negative numeric domains, keeping the filled area meaningful.
- `use-chart-interaction.ts`: allow normal vertical touch scrolling and pinch zoom over the plot.
- `path-stroke-utils.ts` and `tooltip/cursor-tooltip-box.tsx`: explicit ref dependencies and a documented content-measurement dependency for Piko's lint configuration.
- Formatting and small lint cleanups use the repository's Bun/Biome rules.

Keep those adaptations when updating the registry sources. No telemetry, remote chart assets, or third-party requests are added by this integration.
