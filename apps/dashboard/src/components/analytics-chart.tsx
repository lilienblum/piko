import { nextBucket, type TimeBucket } from "@/lib/time-buckets";
import { curveLinear } from "d3-shape";
import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { AreaChart } from "@/components/charts/area-chart";
import { Area } from "@/components/charts/area";
import { useChartHover, useChartStable } from "@/components/charts/chart-context";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip/chart-tooltip";
import { XAxis } from "@/components/charts/x-axis";
import { YAxis } from "@/components/charts/y-axis";
import { number, type QueryResult } from "@/lib/api";

/** Let keyboard inspection use the same tooltip/crosshair as pointer inspection. */
function KeyboardCursor({ index }: { index: number | null }) {
  const { data, xAccessor, xScale, yScale } = useChartStable();
  const { setTooltipData } = useChartHover();
  useEffect(() => {
    const point = index === null ? undefined : data[index];
    setTooltipData(
      point && index !== null
        ? {
            point,
            index,
            x: xScale(xAccessor(point)),
            yPositions: typeof point.value === "number" ? { value: yScale(point.value) } : {},
          }
        : null,
    );
  }, [index, data, xAccessor, xScale, yScale, setTooltipData]);
  return null;
}

export function AnalyticsChart({
  series,
  label,
  bucket,
  unit,
  range,
}: {
  series: QueryResult["series"];
  label: string;
  bucket: TimeBucket;
  unit?: string;
  range?: { from: string; to: string };
}) {
  const instructionsId = useId();
  const [keyboardIndex, setKeyboardIndex] = useState<number | null>(null);
  const points = useMemo(
    () => series.map((point) => ({ ...point, date: new Date(point.time) })),
    [series],
  );
  const axisLabels = useMemo(
    () =>
      points.map(({ date }) =>
        date.toLocaleString("en-US", {
          timeZone: "UTC",
          month: "short",
          ...(bucket === "month" ? { year: "numeric" as const } : { day: "numeric" as const }),
          ...(bucket === "hour"
            ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const }
            : {}),
        }),
      ),
    [points, bucket],
  );
  const valueLabel = (value: unknown) =>
    typeof value === "number" ? `${number(value, 2)}${unit ? ` ${unit}` : ""}` : "No numeric value";
  const dateLabel = (time: number) => {
    const partial =
      range && (time < Date.parse(range.from) || nextBucket(time, bucket) > Date.parse(range.to));
    const date = new Date(time).toLocaleString("en-US", {
      timeZone: "UTC",
      month: "short",
      year: "numeric",
      ...(bucket !== "month" ? { day: "numeric" as const } : {}),
      ...(bucket === "hour"
        ? { hour: "2-digit" as const, minute: "2-digit" as const, hourCycle: "h23" as const }
        : {}),
    });
    return `${bucket === "week" ? "Week of " : ""}${date} UTC${partial ? ` · partial ${bucket}` : ""}`;
  };
  const inspect = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!points.length) return;
    const current = keyboardIndex ?? -1;
    const next =
      event.key === "ArrowRight"
        ? Math.min(current + 1, points.length - 1)
        : event.key === "ArrowLeft"
          ? Math.max(current - 1, 0)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? points.length - 1
              : event.key === "Escape"
                ? null
                : undefined;
    if (next === undefined) return;
    event.preventDefault();
    setKeyboardIndex(next);
  };
  const selected = keyboardIndex === null ? undefined : points[keyboardIndex];
  return (
    <div
      className="series-chart"
      data-slot="chart"
      data-chart-library="bklit"
      role="application"
      aria-roledescription="interactive chart"
      aria-label={`${label} by UTC ${bucket === "day" ? "date" : bucket}`}
      aria-describedby={instructionsId}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: This chart implements arrow-key inspection.
      tabIndex={0}
      onKeyDown={inspect}
      onBlur={() => setKeyboardIndex(null)}
      onPointerMove={() => setKeyboardIndex(null)}
    >
      <span className="sr-only" id={instructionsId}>
        Use Left and Right arrows to inspect values, Home and End for the first and last bucket, and
        Escape to dismiss.
      </span>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {selected ? `${dateLabel(selected.time)}. ${label}: ${valueLabel(selected.value)}` : ""}
      </span>
      <AreaChart
        data={points}
        className="bklit-plot"
        aspectRatio="auto"
        style={{ touchAction: "pan-y pinch-zoom" }}
        margin={{ top: 12, right: 28, bottom: bucket === "hour" ? 44 : 36, left: unit ? 74 : 48 }}
        animationDuration={0}
        yDomainTween={false}
      >
        <Grid horizontal vertical={false} strokeDasharray="2 5" fadeHorizontal={false} />
        <Area
          dataKey="value"
          fill="var(--data)"
          stroke="var(--data)"
          curve={curveLinear}
          fillOpacity={0.08}
          gradientToOpacity={0.01}
          animate={false}
          showHighlight={false}
          showMarkers={Boolean(unit) || points.filter((point) => point.value !== null).length === 1}
          markers={{ radius: 2, strokeWidth: 0, ringGap: 0, outlineWidth: 0 }}
        />
        <XAxis
          labels={axisLabels}
          numTicks={bucket === "hour" ? { base: 2, sm: 4, md: 6 } : { base: 3, sm: 5, md: 7 }}
          tickerHalfWidth={0}
        />
        <YAxis formatValue={(value) => `${number(value, 1)}${unit ? ` ${unit}` : ""}`} />
        <ChartTooltip
          showDatePill={false}
          dotSize={3}
          dotHaloScale={0}
          indicatorFadeEdges="none"
          damping={0}
          animateSize={false}
          exit={false}
          panelStyle={{
            borderRadius: 6,
            border: "1px solid var(--border)",
            boxShadow: "0 8px 20px color-mix(in srgb, var(--foreground) 10%, transparent)",
          }}
          content={({ point }) => (
            <div className="chart-tooltip-content">
              <div className="chart-tooltip-date">{dateLabel(Number(point.time))}</div>
              <div className="chart-tooltip-value">
                <span>{label}</span>
                <strong>{valueLabel(point.value)}</strong>
              </div>
            </div>
          )}
        />
        <KeyboardCursor index={keyboardIndex} />
      </AreaChart>
    </div>
  );
}
