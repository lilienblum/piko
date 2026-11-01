import { useId, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AnalyticsUpIcon,
  ArrowRight01Icon,
  ArrowRight02Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons";
import { Link } from "@tanstack/react-router";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { groupLabel, number, type Group, type QueryResult } from "@/lib/api";
import type { ExploreDrilldown } from "@/lib/explore-search";
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Couldn’t load this view</AlertTitle>
      <AlertDescription>
        {message}
        {retry && (
          <Button variant="outline" size="sm" onClick={retry}>
            <HugeiconsIcon
              icon={RefreshIcon}
              strokeWidth={2}
              aria-hidden="true"
              data-icon="inline-start"
            />
            Try again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
export function NoEvents() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={AnalyticsUpIcon} strokeWidth={2} aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>No events in this range</EmptyTitle>
        <EmptyDescription>
          No events match this date range. Try a wider range or connect your project in Settings.
        </EmptyDescription>
      </EmptyHeader>
      <Button variant="outline" asChild>
        <Link to="/settings">
          Connect a product
          <HugeiconsIcon
            icon={ArrowRight02Icon}
            strokeWidth={2}
            aria-hidden="true"
            data-icon="inline-end"
          />
        </Link>
      </Button>
    </Empty>
  );
}
export function SeriesChart({
  data,
  title,
  description,
  label = "Events",
  controls,
  bucket = "day",
  unit,
  range,
  pending = false,
  error,
  retry,
  emptyMessage,
}: {
  data?: QueryResult;
  title: string;
  description: string;
  label?: string;
  controls?: ReactNode;
  bucket?: "day" | "hour";
  unit?: string;
  range?: { from: string; to: string };
  pending?: boolean;
  error?: string;
  retry?: () => void;
  emptyMessage?: string;
}) {
  const bucketWidth = bucket === "hour" ? 3600000 : 86400000;
  const from = range ? Date.parse(range.from) : undefined;
  const to = range ? Date.parse(range.to) : undefined;
  const partialFirst = from !== undefined && from % bucketWidth !== 0;
  const partialLast = to !== undefined && to % bucketWidth !== 0;
  const partialLabel =
    partialFirst && partialLast
      ? `First and last ${bucket}s are partial.`
      : partialFirst
        ? `First ${bucket} is partial.`
        : partialLast
          ? `Last ${bucket} is partial.`
          : `Complete UTC ${bucket}s.`;
  const gradientId = useId().replace(/:/g, "");
  return (
    <Card className={`chart-card${controls ? " chart-card-interactive" : ""}`}>
      <CardHeader>
        <div className="card-heading">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="chart-legend">
            <span />
            {label}
          </div>
        </div>
        {controls}
      </CardHeader>
      <CardContent>
        <div className="chart-plot" aria-busy={pending}>
          {pending ? (
            <div
              className="series-chart chart-placeholder"
              role="status"
              aria-label="Loading chart"
            >
              <div className="chart-placeholder-label">
                <Spinner /> Loading chart
              </div>
            </div>
          ) : !data || emptyMessage ? (
            <div className="series-chart chart-message" role="status">
              {emptyMessage ?? "Chart unavailable."}
            </div>
          ) : (
            <ChartContainer
              className="series-chart"
              aria-label={`${label} by UTC ${bucket === "hour" ? "hour" : "date"}`}
              config={{ value: { label, color: "var(--data)" } }}
            >
              <AreaChart
                accessibilityLayer
                data={data.series}
                margin={{ top: 12, right: 14, bottom: 0, left: unit ? -4 : -20 }}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--data)" stopOpacity={0.08} />
                    <stop offset="95%" stopColor="var(--data)" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 5" />
                <XAxis
                  dataKey="time"
                  tickFormatter={(time: number) =>
                    new Date(time).toLocaleString("en-US", {
                      ...(bucket === "hour"
                        ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
                        : {}),
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    })
                  }
                  tickLine={false}
                  axisLine={false}
                  minTickGap={40}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  dy={10}
                />
                <YAxis
                  width={unit ? 82 : 60}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickFormatter={(value: number) => `${number(value, 1)}${unit ? ` ${unit}` : ""}`}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, payload) => {
                        const time = Number(payload[0]?.payload.time);
                        const partial =
                          (from !== undefined && time < from) ||
                          (to !== undefined && time + bucketWidth > to);
                        return `${new Date(time).toLocaleString("en-US", { timeZone: "UTC", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} UTC${partial ? ` · partial ${bucket}` : ""}`;
                      }}
                      formatter={(value) => (
                        <>
                          <span className="text-muted-foreground">{label}</span>
                          <span className="ml-auto font-mono font-medium tabular-nums">
                            {number(Number(value), 2)}
                            {unit ? ` ${unit}` : ""}
                          </span>
                        </>
                      )}
                    />
                  }
                />
                <Area
                  type="linear"
                  dataKey="value"
                  stroke="var(--data)"
                  fill={`url(#${gradientId})`}
                  strokeWidth={2}
                  dot={unit ? { r: 2, fill: "var(--data)", strokeWidth: 0 } : false}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              </AreaChart>
            </ChartContainer>
          )}
          {error && (
            <div className="chart-error" role="alert">
              <span>
                {data ? "Couldn’t refresh chart. " : "Couldn’t load chart. "}
                {error}
              </span>
              <Button variant="outline" size="sm" onClick={retry}>
                Retry chart
              </Button>
            </div>
          )}
        </div>
        {range && (
          <p className="chart-period-note">
            {bucket === "hour" ? "Hourly" : "Daily"} · UTC · {partialLabel}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
type BreakdownProps = {
  title: string;
  groups: Group[];
  unit?: string;
  total?: number;
  drilldown?: (group: Group) => ExploreDrilldown | undefined;
};
export function Breakdown({ description, ...props }: BreakdownProps & { description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <BreakdownRows {...props} />
      </CardContent>
    </Card>
  );
}
export function BreakdownRows({
  title,
  groups,
  unit = "Events",
  total,
  drilldown,
}: BreakdownProps) {
  const max = Math.max(...groups.map((g) => g.value ?? 0), 1);
  return (
    <>
      <div className="breakdown-head">
        <span>{title}</span>
        <span>
          {unit}
          {total !== undefined ? " · Share" : ""}
        </span>
      </div>
      {groups.length ? (
        groups.map((g) => {
          const target = drilldown?.(g);
          const label = g.display ?? groupLabel(g.label);
          const content = (
            <>
              <div
                className="breakdown-fill"
                style={{ width: `${Math.max(0, (g.value ?? 0) / max) * 85}%` }}
              />
              <span className="breakdown-label" title={label}>
                {label}
              </span>
              <span className="breakdown-values">
                <span className="breakdown-value">{number(g.value, 1)}</span>
                {total !== undefined && (
                  <span className="breakdown-share">
                    {number(total ? (g.count / total) * 100 : 0, 1)}%
                  </span>
                )}
                {target && (
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    strokeWidth={2}
                    className="breakdown-arrow"
                    aria-hidden="true"
                  />
                )}
              </span>
            </>
          );
          return target ? (
            <Link
              className="breakdown-row"
              to="/explore"
              search={{ drilldown: target }}
              key={JSON.stringify(g.label)}
              aria-label={`Explore ${label}`}
            >
              {content}
            </Link>
          ) : (
            <div className="breakdown-row" key={JSON.stringify(g.label)}>
              {content}
            </div>
          );
        })
      ) : (
        <p className="quiet">No values in this range.</p>
      )}
    </>
  );
}
