import { useId } from "react";
import { ArrowRight, ChartNoAxesCombined, ChevronRight, RefreshCw } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
            <RefreshCw data-icon="inline-start" />
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
          <ChartNoAxesCombined />
        </EmptyMedia>
        <EmptyTitle>Your next insight starts with an event</EmptyTitle>
        <EmptyDescription>
          No events match this date range. Try a wider range or connect your product in Settings.
        </EmptyDescription>
      </EmptyHeader>
      <Button variant="outline" asChild>
        <Link to="/settings">
          Connect a product
          <ArrowRight data-icon="inline-end" />
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
}: {
  data: QueryResult;
  title: string;
  description: string;
  label?: string;
}) {
  const gradientId = useId().replace(/:/g, "");
  return (
    <Card className="chart-card">
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
      </CardHeader>
      <CardContent>
        <ChartContainer
          className="series-chart"
          aria-label={`${label} by UTC date`}
          config={{ value: { label, color: "var(--primary)" } }}
        >
          <AreaChart
            accessibilityLayer
            data={data.series}
            margin={{ top: 12, right: 14, bottom: 0, left: -20 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.14} />
                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
            <XAxis
              dataKey="time"
              tickFormatter={(time: number) =>
                new Date(time).toLocaleDateString("en-US", {
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
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickFormatter={(value: number) => number(value, 1)}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) =>
                    `${new Date(Number(payload[0]?.payload.time)).toLocaleString("en-US", { timeZone: "UTC", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} UTC`
                  }
                  formatter={(value) => (
                    <>
                      <span className="text-muted-foreground">{label}</span>
                      <span className="ml-auto font-mono font-medium tabular-nums">
                        {number(Number(value), 2)}
                      </span>
                    </>
                  )}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--primary)"
              fill={`url(#${gradientId})`}
              strokeWidth={2.2}
              isAnimationActive={false}
              connectNulls={false}
            />
          </AreaChart>
        </ChartContainer>
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
          const content = (
            <>
              <div
                className="breakdown-fill"
                style={{ width: `${Math.max(0, (g.value ?? 0) / max) * 85}%` }}
              />
              <span className="breakdown-label" title={groupLabel(g.label)}>
                {groupLabel(g.label)}
              </span>
              <span className="breakdown-values">
                <span className="breakdown-value">{number(g.value, 1)}</span>
                {total !== undefined && (
                  <span className="breakdown-share">
                    {number(total ? (g.count / total) * 100 : 0, 1)}%
                  </span>
                )}
                {target && <ChevronRight className="breakdown-arrow" aria-hidden="true" />}
              </span>
            </>
          );
          return target ? (
            <Link
              className="breakdown-row"
              to="/explore"
              search={{ drilldown: target }}
              key={JSON.stringify(g.label)}
              aria-label={`Explore ${groupLabel(g.label)}`}
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
