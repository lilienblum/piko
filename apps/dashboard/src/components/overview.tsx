import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { bucketLabels, type TimeBucket } from "@/lib/time-buckets";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { OverviewLoading, BreakdownLoading } from "./loading";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@/lib/use-query";
import { number, sourceGroups, type Group } from "@/lib/api";
import type { ExploreDrilldown } from "@/lib/explore-search";
import { useWorkspace, useAnalyticsPending, PageHeader, NoProduct } from "./app-shell";
import { Breakdown, BreakdownRows, ErrorState, SeriesChart } from "./shared";
import { ValueSelect } from "./value-select";

type ChartChoice = {
  id: string;
  label: string;
  measure: "count" | "actors" | "avg" | "p95";
  identity_kind?: "visitor" | "installation";
  property?: "duration_ms";
  unit?: "ms";
};
const chartChoices: ChartChoice[] = [
  { id: "count", label: "Events", measure: "count" },
  { id: "actors", label: "Identified actors", measure: "actors" },
  { id: "visitors", label: "Unique visitors", measure: "actors", identity_kind: "visitor" },
  {
    id: "installations",
    label: "Active installations",
    measure: "actors",
    identity_kind: "installation",
  },
  { id: "average", label: "Average duration", measure: "avg", property: "duration_ms", unit: "ms" },
  { id: "p95", label: "p95 duration", measure: "p95", property: "duration_ms", unit: "ms" },
];
const dimensions = [
  ["source_id", "Sources"],
  ["source", "Clients"],
  ["property:path", "Pages"],
  ["property:command", "Commands"],
  ["property:referrer", "Referrers"],
  ["property:utm_source", "Campaign sources"],
  ["property:utm_campaign", "Campaigns"],
  ["property:screen", "Screens"],
  ["property:version", "Versions"],
  ["property:os", "OS"],
  ["property:arch", "Architecture"],
] as const;
export function Overview() {
  const { product, sourceId } = useWorkspace();
  return product ? <ProductOverview key={`${product.id}:${sourceId ?? "all"}`} /> : <NoProduct />;
}
function ProductOverview() {
  const { product, source, sourceId, range, refresh, refreshKey } = useWorkspace();
  const [dimension, setDimension] = useState<string>("source_id");
  const body = { ...range, source_id: sourceId, measure: "count", group_by: "name" };
  const backgroundScope = JSON.stringify([range.from, body.group_by]);
  const query = useQuery(product?.id, body, refreshKey, backgroundScope);
  const secondary = useQuery(
    product?.id,
    { ...body, group_by: dimension },
    refreshKey,
    `${backgroundScope}:${dimension}`,
  );
  const choices = chartChoices;
  const [chartMetric, setChartMetric] = useState("count");
  const [chartInterval, setChartInterval] = useState<TimeBucket>("day");
  const [chartRetry, setChartRetry] = useState(0);
  const choice = choices.find((option) => option.id === chartMetric) ?? choices[0];
  const hourlyAvailable = Date.parse(range.to) - Date.parse(range.from) <= 31 * 86400000;
  const bucket = chartInterval === "hour" && !hourlyAvailable ? "day" : chartInterval;
  const separateChart = choice.id !== "count" || bucket !== "day";
  const chartQuery = useQuery(
    separateChart ? product?.id : undefined,
    {
      ...body,
      measure: choice.measure,
      identity_kind: choice.identity_kind,
      property: choice.property,
      bucket,
      page_size: 1,
    },
    `${refreshKey}:${chartRetry}`,
    `${backgroundScope}:${choice.id}:${bucket}`,
  );
  const chartResult = separateChart ? chartQuery : query;
  useAnalyticsPending(
    query.refreshing || secondary.refreshing || (separateChart && chartQuery.refreshing),
  );
  if (!product) return <NoProduct />;
  const drilldown = (groupBy: string, group: Group): ExploreDrilldown | undefined => {
    if (group.label === null) return;
    const context = { productId: product.id, sourceId, ...range };
    if (groupBy === "source_id" && typeof group.label === "string")
      return { ...context, sourceId: group.label };
    if (groupBy === "name" && typeof group.label === "string")
      return { ...context, event: group.label };
    if (groupBy === "source" && typeof group.label === "string")
      return { ...context, source: group.label };
    if (groupBy.startsWith("property:"))
      return { ...context, filter: { property: groupBy.slice(9), value: group.label } };
  };
  const refreshError = query.error || (secondary.data && secondary.error);
  const s = query.data?.summary;
  const metrics = [
    {
      label: "Events",
      value: number(s?.total),
      detail: source ? "Events from this source" : "All sources, one project",
    },
    {
      label: "Identified actors",
      value: s?.total && !s.actors ? "—" : number(s?.actors),
      detail: s?.total && !s.actors ? "No actor IDs received" : "Identity kinds counted separately",
    },
    {
      label: "Success rate",
      value: s?.success_rate == null ? "—" : `${number(s.success_rate, 1)}%`,
      detail: "Events reporting a boolean success value",
    },
    {
      label: "Average duration",
      value: s?.avg_duration == null ? "—" : `${number(s.avg_duration)} ms`,
      detail:
        s?.p95_duration == null
          ? "No numeric durations received"
          : `p95 · ${number(s.p95_duration)} ms`,
    },
  ];
  const chart = (
    <SeriesChart
      data={chartResult.data}
      title="Activity over time"
      description={
        choice.measure === "actors"
          ? `${choice.identity_kind === "visitor" ? "Visitors" : choice.identity_kind === "installation" ? "Installations" : "Identities"} counted once per ${bucket}.`
          : choice.unit
            ? `${choice.measure === "p95" ? "95th-percentile" : "Average"} duration per ${bucket}, in milliseconds.`
            : `${choice.label} per ${bucket}, including anonymous activity.`
      }
      label={choice.label}
      bucket={bucket}
      unit={choice.unit}
      range={range}
      pending={chartResult.loading}
      error={separateChart ? chartQuery.error : undefined}
      retry={() => setChartRetry((key) => key + 1)}
      emptyMessage={
        !chartResult.data
          ? undefined
          : s?.total === 0
            ? "No events in this range. Try another date range or connect a source in Settings."
            : choice.measure === "actors" && !chartResult.data.summary.value
              ? choice.identity_kind === "visitor"
                ? "No visitor IDs received in this range."
                : choice.identity_kind === "installation"
                  ? "No installation IDs received in this range."
                  : "No actor IDs received in this range."
              : choice.unit && chartResult.data.summary.value === null
                ? "No numeric durations received in this range."
                : undefined
      }
      controls={
        <div className="chart-controls">
          <ValueSelect
            label="Chart metric"
            disabled={query.loading}
            value={choice.id}
            onValueChange={setChartMetric}
            options={choices.map((option) => [option.id, option.label])}
          />
          <ToggleGroup
            aria-label="Chart interval"
            variant="outline"
            spacing={0}
            value={[bucket]}
            disabled={query.loading}
            onValueChange={(values) => {
              const value = values[0];
              if (value && value in bucketLabels) setChartInterval(value as TimeBucket);
            }}
          >
            {(["hour", "day", "week", "month"] as const).map((interval) => (
              <ToggleGroupItem
                key={interval}
                value={interval}
                disabled={interval === "hour" && !hourlyAvailable}
                title={
                  interval === "hour" && !hourlyAvailable
                    ? "Hourly is available for ranges up to 31 days."
                    : undefined
                }
              >
                {bucketLabels[interval]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      }
    />
  );
  return (
    <>
      <PageHeader
        title={source ? `${product.name} / ${source.name}` : product.name}
        description="Events, identities, and performance across your project."
      >
        <div className="heading-actions">
          <Button
            variant="outline"
            nativeButton={false}
            role="link"
            render={<Link to="/explore" />}
          >
            Explore events
            <HugeiconsIcon
              icon={ArrowRight02Icon}
              strokeWidth={2}
              aria-hidden="true"
              data-icon="inline-end"
            />
          </Button>
        </div>
      </PageHeader>
      {query.error && !query.data ? (
        <ErrorState message={query.error} retry={refresh} />
      ) : query.loading ? (
        <OverviewLoading labels={metrics.map((metric) => metric.label)} chart={chart} />
      ) : (
        query.data && (
          <>
            {refreshError && <ErrorState message={refreshError} retry={refresh} />}
            <div className="metrics" data-columns={metrics.length}>
              {metrics.map((m) => (
                <Card key={m.label} className="metric-card">
                  <CardContent>
                    <div className="metric-label">{m.label}</div>
                    <div className="metric-value">{m.value}</div>
                    <p>{m.detail}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            {chart}
            <div className="breakdowns overview-breakdowns">
              <Breakdown
                title="Top events"
                description="Events ranked by count"
                groups={query.data.groups}
                total={s?.total}
                drilldown={(group) => drilldown(body.group_by, group)}
              />
              <Card>
                <CardHeader>
                  <CardTitle>Breakdown</CardTitle>
                  <CardDescription>Choose a dimension to look closer.</CardDescription>
                  <ValueSelect
                    label="Breakdown"
                    value={dimension}
                    onValueChange={setDimension}
                    options={dimensions}
                  />
                </CardHeader>
                <CardContent>
                  {secondary.error && !secondary.data ? (
                    <ErrorState message={secondary.error} retry={refresh} />
                  ) : secondary.loading ? (
                    <BreakdownLoading />
                  ) : (
                    <BreakdownRows
                      title={dimensions.find(([value]) => value === dimension)?.[1] ?? "Sources"}
                      groups={
                        dimension === "source_id"
                          ? sourceGroups(secondary.data?.groups ?? [], product.sources)
                          : (secondary.data?.groups ?? [])
                      }
                      total={secondary.data?.summary.total}
                      drilldown={(group) => drilldown(dimension, group)}
                    />
                  )}
                </CardContent>
              </Card>
            </div>
            <div className="insight-note">
              <span className="status-dot" />
              {product.retention_days}-day retention<span>·</span>
              No identity is inferred from IP addresses or user agents.
              <Link to="/settings">
                Manage collection
                <HugeiconsIcon icon={ArrowRight02Icon} strokeWidth={2} aria-hidden="true" />
              </Link>
            </div>
          </>
        )
      )}
    </>
  );
}
