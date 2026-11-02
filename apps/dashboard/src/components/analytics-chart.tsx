import { areaY, defineChart, dot, lineY, type ChartPoint } from "@tanstack/charts";
import { crosshair } from "@tanstack/charts/crosshair";
import { decorative } from "@tanstack/charts/mark/decorative";
import { Chart } from "@tanstack/charts/react";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { useMemo } from "react";
import { number, type QueryResult } from "@/lib/api";
import { nextBucket, type TimeBucket } from "@/lib/time-buckets";

function formatDate(time: number, bucket: TimeBucket, full = false) {
  return new Date(time).toLocaleString("en-US", {
    timeZone: "UTC",
    month: "short",
    ...(full || bucket === "month" ? { year: "numeric" as const } : {}),
    ...(bucket !== "month" ? { day: "numeric" as const } : {}),
    ...(bucket === "hour"
      ? { hour: "2-digit" as const, minute: "2-digit" as const, hourCycle: "h23" as const }
      : {}),
  });
}

export function AnalyticsChart({
  series,
  label,
  bucket,
  unit,
  range,
  compact = false,
}: {
  series: QueryResult["series"];
  label: string;
  bucket: TimeBucket;
  unit?: string;
  compact?: boolean;
  range?: { from: string; to: string };
}) {
  const from = range?.from;
  const to = range?.to;
  const definition = useMemo(() => {
    const markers =
      (!compact && Boolean(unit)) || series.filter((point) => point.value !== null).length === 1;
    return defineChart({
      svgAnimation: false,
      focus: "nearest-x",
      maxFocusDistance: Number.POSITIVE_INFINITY,
      focusRing: false,
      tooltip: {
        use: tooltip,
        motion: false,
        content: (points: readonly ChartPoint<QueryResult["series"][number], number, number>[]) => {
          const point = points[0];
          if (!point) return { rows: [] };
          const { time, value } = point.datum;
          const partial =
            from && to && (time < Date.parse(from) || nextBucket(time, bucket) > Date.parse(to));
          return {
            title: `${bucket === "week" ? "Week of " : ""}${formatDate(time, bucket, true)} UTC${partial ? ` · partial ${bucket}` : ""}`,
            rows: [
              {
                label,
                value:
                  value === null
                    ? "No numeric value"
                    : `${number(value, 2)}${unit ? ` ${unit}` : ""}`,
              },
            ],
          };
        },
      },
      chart: ({ width }) => {
        const count = Math.min(series.length, width < 480 ? (bucket === "hour" ? 2 : 3) : 7);
        const ticks = Array.from(
          { length: count },
          (_, index) =>
            series[count === 1 ? 0 : Math.round((index * (series.length - 1)) / (count - 1))].time,
        );
        return {
          marks: [
            decorative(
              areaY(series, {
                id: "values-area",
                x: "time",
                y1: 0,
                y2: "value",
                fill: "var(--data)",
                fillOpacity: 0.07,
              }),
            ),
            decorative(
              lineY(series, {
                id: "values-line",
                x: "time",
                y: "value",
                stroke: "var(--data)",
                strokeWidth: 2,
                points: markers,
              }),
            ),
            // Invisible focus targets let missing buckets be inspected without drawing a zero.
            dot(series, {
              id: "buckets",
              key: "time",
              x: "time",
              y: (point) => point.value ?? 0,
              r: 0,
            }),
            crosshair({ x: { stroke: "var(--muted-foreground)", strokeWidth: 1 }, y: false }),
          ],
          scales: {
            x: {
              scale: scaleLinear,
              axis: {
                line: false,
                tickLabels: { fontSize: 12, opacity: 1 },
                ticks: {
                  values: ticks,
                  size: 0,
                  padding: 12,
                  format: (time) => formatDate(time, bucket),
                },
              },
            },
            y: {
              scale: scaleLinear,
              nice: true,
              grid: { stroke: "var(--border)", strokeOpacity: 1, strokeDasharray: "2 5" },
              axis: {
                line: false,
                tickLabels: { fontSize: 12, opacity: 1 },
                ticks: {
                  count: compact ? 3 : 4,
                  size: 0,
                  padding: 10,
                  format: (value) => `${number(value, 1)}${unit ? ` ${unit}` : ""}`,
                },
              },
            },
          },
          margin: { top: 12 },
          theme: {
            foreground: "var(--foreground)",
            muted: "var(--muted-foreground)",
            grid: "var(--border)",
            background: "transparent",
          },
        };
      },
    });
  }, [series, label, bucket, unit, from, to, compact]);
  return (
    <div className="series-chart" data-slot="chart" data-chart-library="tanstack">
      <Chart
        definition={definition}
        onRender={({ svg, interaction }) => {
          // TanStack 1.1 only handles Escape for pinned tooltips; preserve ordinary dismissal too.
          svg.onkeydown = (event) => {
            if (event.key === "Escape") interaction.setControlledFocus(null);
          };
        }}
        className="analytics-plot"
        style={{ height: "100%", touchAction: "pan-y pinch-zoom" }}
        ariaLabel={`${label} by UTC ${bucket === "day" ? "date" : bucket}`}
        ariaDescription="Use Left and Right arrows to inspect values, Home and End for the first and last bucket, and Escape to dismiss."
      />
    </div>
  );
}
