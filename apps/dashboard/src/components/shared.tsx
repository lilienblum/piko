import { ArrowRight, ChartNoAxesCombined, RefreshCw } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
import { Skeleton } from "@/components/ui/skeleton";
import { groupLabel, number, type Group, type QueryResult } from "@/lib/api";
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
export function Loading() {
  return (
    <div role="status" className="loading-grid" aria-label="Loading analytics" aria-busy="true">
      <div className="metrics">
        {[1, 2, 3, 4].map((n) => (
          <Skeleton key={n} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-80" />
      <div className="breakdowns">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
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
        <div className="series-chart" role="img" aria-label={`${label} by UTC date`}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart data={data.series} margin={{ top: 12, right: 14, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="activity-fill" x1="0" y1="0" x2="0" y2="1">
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
              <Tooltip
                labelFormatter={(time) =>
                  `${new Date(Number(time)).toLocaleString("en-US", {
                    timeZone: "UTC",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })} UTC`
                }
                formatter={(value) => [number(Number(value), 2), label]}
                contentStyle={{
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  boxShadow: "0 6px 24px #2630440c",
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--primary)"
                fill="url(#activity-fill)"
                strokeWidth={2.2}
                isAnimationActive={false}
                connectNulls={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
export function Breakdown({
  title,
  description,
  groups,
  unit = "Events",
}: {
  title: string;
  description: string;
  groups: Group[];
  unit?: string;
}) {
  const max = Math.max(...groups.map((g) => g.value ?? 0), 1);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="breakdown-head">
          <span>{title}</span>
          <span>{unit}</span>
        </div>
        {groups.length ? (
          groups.map((g) => (
            <div className="breakdown-row" key={JSON.stringify(g.label)}>
              <div
                className="breakdown-fill"
                style={{ width: `${Math.max(0, (g.value ?? 0) / max) * 85}%` }}
              />
              <span className="breakdown-label" title={groupLabel(g.label)}>
                {groupLabel(g.label)}
              </span>
              <span className="breakdown-value">{number(g.value, 1)}</span>
            </div>
          ))
        ) : (
          <p className="quiet">No values in this range.</p>
        )}
      </CardContent>
    </Card>
  );
}
