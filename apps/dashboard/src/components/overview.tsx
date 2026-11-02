import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { bucketLabels, partialBucketNote, type TimeBucket } from "@/lib/time-buckets";
import { useQuery } from "@/lib/use-query";
import { number, sourceGroups, type Group } from "@/lib/api";
import { sourceDistribution } from "@/lib/overview-widgets";
import type { OverviewSearch } from "@/lib/workspace-search";
import type { ExploreDrilldown } from "@/lib/explore-search";
import { useWorkspace, useAnalyticsPending, PageHeader, NoProduct } from "./app-shell";
import { BreakdownRows } from "./shared";
import { AnalyticsChart } from "./analytics-chart";
import { ValueSelect } from "./value-select";
import { SourceIcon } from "./source-icon";
import { DonutChart, OverviewWidget, WidgetContent, WidgetValue } from "./overview-widgets";

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
  ["name", "Top events"],
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

const compactCount = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumSignificantDigits: 3,
});

export function Overview() {
  const { product, sourceId } = useWorkspace();
  return product ? <ProductOverview key={`${product.id}:${sourceId ?? "all"}`} /> : <NoProduct />;
}
function ProductOverview() {
  const { product, source, sourceId, range, refresh, refreshKey } = useWorkspace();
  const search = useSearch({ strict: false });
  const navigate = useNavigate({ from: "/projects/$projectSlug/" });
  const dimension = search.breakdown ?? "name";
  const chartMetric = search.metric ?? "count";
  const chartInterval = search.interval ?? "day";
  const durationMetric = search.duration ?? "avg";
  const update = (patch: OverviewSearch) =>
    void navigate({ search: (previous) => ({ ...previous, ...patch }), resetScroll: false });
  const setDimension = (breakdown: string) => update({ breakdown });
  const setChartMetric = (metric: string) => update({ metric: metric as OverviewSearch["metric"] });
  const setChartInterval = (interval: TimeBucket) => update({ interval });
  const setDurationMetric = (duration: string) =>
    update({ duration: duration as OverviewSearch["duration"] });
  const body = { ...range, source_id: sourceId, measure: "count", group_by: "name" };
  const scope = JSON.stringify([range.from, sourceId]);
  const query = useQuery(product?.id, body, refreshKey, scope);
  const canCompareSources = !sourceId && (product?.sources.length ?? 0) > 1;
  const needsSourceQuery = canCompareSources || dimension === "source_id";
  const sources = useQuery(
    needsSourceQuery ? product?.id : undefined,
    { ...body, group_by: "source_id" },
    refreshKey,
    `${scope}:sources`,
  );
  const separateBreakdown = dimension !== "name" && dimension !== "source_id";
  const secondary = useQuery(
    separateBreakdown ? product?.id : undefined,
    { ...body, group_by: dimension },
    refreshKey,
    `${scope}:${dimension}`,
  );
  const breakdown = dimension === "name" ? query : dimension === "source_id" ? sources : secondary;
  const choice = chartChoices.find((option) => option.id === chartMetric) ?? chartChoices[0];
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
    refreshKey,
    `${scope}:${choice.id}:${bucket}`,
  );
  const activity = separateChart ? chartQuery : query;
  const s = query.data?.summary;
  const hasDuration = s?.avg_duration != null;
  const duration = useQuery(
    hasDuration ? product?.id : undefined,
    {
      ...body,
      measure: durationMetric,
      property: "duration_ms",
      bucket,
      page_size: 1,
    },
    refreshKey,
    `${scope}:duration:${durationMetric}:${bucket}`,
  );
  useAnalyticsPending(
    query.refreshing ||
      (needsSourceQuery && sources.refreshing) ||
      (separateBreakdown && secondary.refreshing) ||
      (separateChart && chartQuery.refreshing) ||
      (hasDuration && duration.refreshing),
  );
  const sourceSlices = useMemo(
    () =>
      sourceDistribution(
        sourceGroups(sources.data?.groups ?? [], product?.sources),
        sources.data?.summary.total ?? 0,
      ),
    [sources.data, product?.sources],
  );
  const singleSource =
    sourceSlices.length === 1 && sourceSlices[0].group ? sourceSlices[0] : undefined;
  const showSources = canCompareSources && (!sources.data || sourceSlices.length > 1);
  const summarySource =
    source ??
    (product?.sources.length === 1
      ? product.sources[0]
      : product?.sources.find((item) => item.id === singleSource?.group?.label));
  const sourceTotal = canCompareSources ? singleSource?.value : s?.total;
  const outcomes = useMemo(
    () =>
      s?.success_rate == null
        ? []
        : [
            { id: "success", label: "Succeeded", value: s.success_rate, color: "var(--success)" },
            {
              id: "failure",
              label: "Failed",
              value: 100 - s.success_rate,
              color: "var(--destructive)",
            },
          ],
    [s?.success_rate],
  );
  if (!product) return <NoProduct />;
  const drilldown = (groupBy: string, group: Group): ExploreDrilldown | undefined => {
    if (group.label === null) return;
    const context = { sourceId, ...range };
    if (groupBy === "source_id" && typeof group.label === "string")
      return { ...context, sourceId: group.label };
    if (groupBy === "name" && typeof group.label === "string")
      return { ...context, event: group.label };
    if (groupBy === "source" && typeof group.label === "string")
      return { ...context, source: group.label };
    if (groupBy.startsWith("property:"))
      return { ...context, filter: { property: groupBy.slice(9), value: group.label } };
  };
  const noEvents =
    s?.total === 0
      ? "No events in this range. Try another date range or connect a source in Settings."
      : undefined;
  const chartEmpty =
    noEvents ??
    (!activity.data
      ? "Chart unavailable."
      : choice.measure === "actors" && !activity.data.summary.value
        ? `No ${choice.identity_kind === "visitor" ? "visitor" : choice.identity_kind === "installation" ? "installation" : "actor"} IDs received in this range.`
        : choice.unit && activity.data.summary.value === null
          ? "No numeric durations received in this range."
          : undefined);
  const actorGroups: Group[] = [
    { label: "Visitors", value: s?.visitors ?? 0, count: s?.visitors ?? 0 },
    { label: "Installations", value: s?.installations ?? 0, count: s?.installations ?? 0 },
    {
      label: "Other actors",
      value: Math.max(0, (s?.actors ?? 0) - (s?.visitors ?? 0) - (s?.installations ?? 0)),
      count: 0,
    },
  ];
  const dimensionLabel = dimensions.find(([value]) => value === dimension)?.[1] ?? "Top events";
  const periodNote = `${bucketLabels[bucket]} · UTC${bucket === "week" ? " (Monday start)" : ""} · ${partialBucketNote(range, bucket)}`;
  return (
    <>
      <PageHeader
        title={source ? `${product.name} / ${source.name}` : product.name}
        description="Usage, reach, and performance at a glance."
      />
      <div className="overview-dashboard">
        <div className="overview-toolbar">
          <div className="overview-toolbar-context">
            {!showSources && summarySource ? (
              <Link
                className="overview-source-summary"
                to="/projects/$projectSlug/explore"
                params={{ projectSlug: product.slug }}
                search={{ drilldown: { sourceId: summarySource.id, ...range } }}
                aria-label={`Explore ${summarySource.name}`}
              >
                <SourceIcon name={summarySource.name} icon={summarySource.icon} />
                <span className="source-summary-name" title={summarySource.name}>
                  {summarySource.name}
                </span>
                {sourceTotal === undefined ? (
                  <Skeleton className="h-3 w-10" />
                ) : (
                  <span className="source-summary-count">
                    {number(sourceTotal)} {sourceTotal === 1 ? "event" : "events"}
                  </span>
                )}
              </Link>
            ) : (
              <span className="overview-toolbar-copy">
                {source ? "Source snapshot" : "Project snapshot"}
              </span>
            )}
            {!showSources && canCompareSources && sources.error && (
              <div className="widget-error" role="alert">
                <span className="widget-error-message">{sources.error}</span>
                <Button variant="ghost" size="sm" onClick={refresh}>
                  Retry
                </Button>
              </div>
            )}
          </div>
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
        <div
          className="overview-grid"
          data-source-comparison={showSources}
          aria-busy={query.loading}
        >
          <OverviewWidget
            title="Activity over time"
            className="activity-widget"
            error={activity.error}
            retry={refresh}
            footer={<span className="chart-period-note">{periodNote}</span>}
          >
            <div className="widget-value-row">
              <WidgetValue
                value={`${number(activity.data?.summary.value, 0)}${choice.unit ? " ms" : ""}`}
                label={choice.label}
                loading={activity.loading}
              />
              <ValueSelect
                label="Chart metric"
                disabled={query.loading}
                value={choice.id}
                onValueChange={setChartMetric}
                options={chartChoices.map((option) => [option.id, option.label])}
              />
            </div>
            <div className="widget-plot chart-plot" aria-busy={activity.loading}>
              <WidgetContent label="chart" loading={activity.loading} empty={chartEmpty}>
                <AnalyticsChart
                  compact
                  series={activity.data?.series ?? []}
                  label={choice.label}
                  bucket={bucket}
                  unit={choice.unit}
                  range={range}
                />
              </WidgetContent>
            </div>
          </OverviewWidget>
          {showSources && (
            <OverviewWidget
              title="Sources"
              className="sources-widget"
              error={sources.error}
              retry={refresh}
              footer={
                sources.data
                  ? `${number(sources.data.summary.total)} events in this range`
                  : "Share of events by source"
              }
            >
              <WidgetContent
                label="sources"
                loading={sources.loading}
                empty={!sources.data ? "Sources unavailable." : undefined}
              >
                <DonutChart
                  data={sourceSlices}
                  label="Events by source"
                  value={compactCount.format(sources.data?.summary.total ?? 0)}
                  detail="events"
                />
                <div className="widget-legend">
                  {sourceSlices.map((slice) => {
                    const target = slice.group && drilldown("source_id", slice.group);
                    const content = (
                      <>
                        <span className="legend-dot" style={{ background: slice.color }} />
                        <span className="legend-name" title={slice.label}>
                          {slice.label}
                        </span>
                        <strong>{number(slice.value)}</strong>
                        <span>
                          {number((slice.value / (sources.data?.summary.total || 1)) * 100, 1)}%
                        </span>
                      </>
                    );
                    return target ? (
                      <Link
                        className="legend-row"
                        key={slice.id}
                        to="/projects/$projectSlug/explore"
                        params={{ projectSlug: product.slug }}
                        search={{ drilldown: target }}
                        aria-label={`Explore ${slice.label}`}
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className="legend-row" key={slice.id}>
                        {content}
                      </div>
                    );
                  })}
                </div>
              </WidgetContent>
            </OverviewWidget>
          )}
          <OverviewWidget
            title="Breakdown"
            className="breakdown-widget"
            controls={
              <ValueSelect
                label="Breakdown"
                value={dimension}
                onValueChange={setDimension}
                options={dimensions}
              />
            }
            error={breakdown.error}
            retry={refresh}
            footer={<span>{number(s?.total)} events in this range</span>}
          >
            <WidgetContent
              label="breakdown"
              loading={breakdown.loading}
              empty={!breakdown.data ? "Breakdown unavailable." : noEvents}
            >
              <section className="widget-ranking breakdowns" aria-label={dimensionLabel}>
                <BreakdownRows
                  title={dimensionLabel}
                  groups={
                    dimension === "source_id"
                      ? sourceGroups(breakdown.data?.groups ?? [], product.sources)
                      : (breakdown.data?.groups ?? [])
                  }
                  total={breakdown.data?.summary.total}
                  drilldown={(group) => drilldown(dimension, group)}
                />
              </section>
            </WidgetContent>
          </OverviewWidget>
          <OverviewWidget
            title="Identified actors"
            className="audience-widget"
            error={query.error}
            retry={refresh}
            footer="Identity kinds are counted separately. IDs are optional."
          >
            <WidgetValue
              value={s?.total && !s.actors ? "—" : number(s?.actors)}
              label="distinct identities"
              loading={query.loading}
              detail={s?.sessions ? `${number(s.sessions)} website sessions` : undefined}
            />
            <WidgetContent
              label="identities"
              loading={query.loading}
              empty={
                !query.data
                  ? "Identities unavailable."
                  : (noEvents ??
                    (!s?.actors
                      ? "No actor IDs received. Anonymous events still count toward activity."
                      : undefined))
              }
            >
              <div className="audience-bars">
                <BreakdownRows title="Identity kind" groups={actorGroups} unit="Actors" />
              </div>
            </WidgetContent>
          </OverviewWidget>
          <OverviewWidget
            title="Success rate"
            className="outcomes-widget"
            error={query.error}
            retry={refresh}
            footer="Among events reporting a boolean success value"
          >
            <WidgetContent
              label="outcomes"
              loading={query.loading}
              empty={
                !query.data
                  ? "Outcomes unavailable."
                  : (noEvents ??
                    (s?.success_rate == null
                      ? "No success values received. Send a boolean success property to measure outcomes."
                      : undefined))
              }
            >
              <DonutChart
                data={outcomes}
                label="Reported outcomes"
                value={`${number(s?.success_rate, 1)}%`}
                detail="succeeded"
                percentage
              />
              <div className="widget-legend">
                {outcomes.map((outcome) => (
                  <div className="legend-row outcome-row" key={outcome.id}>
                    <span className="legend-dot" style={{ background: outcome.color }} />
                    <span className="legend-name">{outcome.label}</span>
                    <strong>{number(outcome.value, 1)}%</strong>
                  </div>
                ))}
              </div>
            </WidgetContent>
          </OverviewWidget>
          <OverviewWidget
            title="Duration"
            className="duration-widget"
            controls={
              <ToggleGroup
                aria-label="Duration measure"
                variant="outline"
                spacing={0}
                value={[durationMetric]}
                onValueChange={(values) => {
                  if (values[0]) setDurationMetric(values[0]);
                }}
              >
                <ToggleGroupItem value="avg">Average</ToggleGroupItem>
                <ToggleGroupItem value="p95">p95</ToggleGroupItem>
              </ToggleGroup>
            }
            error={duration.error ?? query.error}
            retry={refresh}
            footer={
              hasDuration
                ? `${durationMetric === "avg" ? `p95 · ${number(s?.p95_duration)} ms` : `Average · ${number(s?.avg_duration)} ms`} · ${bucketLabels[bucket].toLowerCase()} buckets`
                : "Only numeric duration_ms values are included"
            }
          >
            <WidgetValue
              value={
                s?.avg_duration == null
                  ? "—"
                  : `${number(durationMetric === "avg" ? s.avg_duration : s.p95_duration)} ms`
              }
              label={durationMetric === "avg" ? "Average duration" : "p95 duration"}
              loading={query.loading}
            />
            <div className="widget-plot">
              <WidgetContent
                label="duration"
                loading={query.loading || (hasDuration && duration.loading)}
                empty={
                  !query.data
                    ? "Duration unavailable."
                    : (noEvents ??
                      (!hasDuration
                        ? "No numeric durations received in this range."
                        : !duration.data
                          ? "Duration unavailable."
                          : undefined))
                }
              >
                <AnalyticsChart
                  compact
                  series={duration.data?.series ?? []}
                  label={durationMetric === "avg" ? "Average duration" : "p95 duration"}
                  bucket={bucket}
                  unit="ms"
                  range={range}
                />
              </WidgetContent>
            </div>
          </OverviewWidget>
        </div>
      </div>
    </>
  );
}
