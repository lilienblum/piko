import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewLoading, BreakdownLoading } from "./loading";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@/lib/use-query";
import { number, sourceGroups, type Group, type Product } from "@/lib/api";
import type { ExploreDrilldown } from "@/lib/explore-search";
import { useWorkspace, useAnalyticsPending, PageHeader, NoProduct, ProductIcon } from "./app-shell";
import { Breakdown, BreakdownRows, ErrorState, NoEvents, SeriesChart } from "./shared";
import { ValueSelect } from "./value-select";

type ChartChoice = {
  id: string;
  label: string;
  measure: "count" | "actors" | "avg" | "p95";
  identity_kind?: "visitor" | "installation";
  property?: "duration_ms";
  unit?: "ms";
};
const chartChoices: Record<Product["kind"], ChartChoice[]> = {
  website: [
    { id: "count", label: "Page views", measure: "count" },
    { id: "visitors", label: "Unique visitors", measure: "actors", identity_kind: "visitor" },
  ],
  tool: [
    { id: "count", label: "Command executions", measure: "count" },
    {
      id: "installations",
      label: "Active installations",
      measure: "actors",
      identity_kind: "installation",
    },
    {
      id: "average",
      label: "Average duration",
      measure: "avg",
      property: "duration_ms",
      unit: "ms",
    },
    { id: "p95", label: "p95 duration", measure: "p95", property: "duration_ms", unit: "ms" },
  ],
  mobile: [
    { id: "count", label: "Events", measure: "count" },
    { id: "actors", label: "Identified actors", measure: "actors" },
  ],
  generic: [
    { id: "count", label: "Events", measure: "count" },
    { id: "actors", label: "Identified actors", measure: "actors" },
  ],
};
export function Overview() {
  const { product, sourceId, dashboardKind } = useWorkspace();
  return product ? (
    <ProductOverview key={`${product.id}:${sourceId ?? "all"}:${dashboardKind}`} />
  ) : (
    <NoProduct />
  );
}
function ProductOverview() {
  const { product, source, sourceId, dashboardKind, range, refresh, refreshKey } = useWorkspace();
  const web = dashboardKind === "website";
  const tool = dashboardKind === "tool";
  const mobile = dashboardKind === "mobile";
  const dimensions = web
    ? [
        ["referrer", "Referrers"],
        ["utm_source", "Sources"],
        ["utm_campaign", "Campaigns"],
      ]
    : tool
      ? [
          ["os", "OS"],
          ["version", "Versions"],
          ["arch", "Architecture"],
        ]
      : mobile
        ? [
            ["screen", "Screens"],
            ["version", "Versions"],
            ["os", "OS"],
          ]
        : [
            ["source_id", "Sources"],
            ["source", "Clients"],
          ];
  const [dimension, setDimension] = useState(dimensions[0][0]);
  const secondaryGroup = web || tool || mobile ? `property:${dimension}` : dimension;
  const body = {
    ...range,
    source_id: sourceId,
    event: web ? "page_view" : tool ? "command_run" : undefined,
    measure: "count",
    group_by: web ? "property:path" : tool ? "property:command" : "name",
  };
  const backgroundScope = JSON.stringify([range.from, body.event, body.group_by]);
  const query = useQuery(product?.id, body, refreshKey, backgroundScope);
  const secondary = useQuery(
    product?.id,
    {
      ...body,
      group_by: secondaryGroup,
    },
    refreshKey,
    `${backgroundScope}:${secondaryGroup}`,
  );
  const choices = chartChoices[dashboardKind];
  const [chartMetric, setChartMetric] = useState("count");
  const [chartInterval, setChartInterval] = useState("day");
  const [chartRetry, setChartRetry] = useState(0);
  const choice = choices.find((option) => option.id === chartMetric) ?? choices[0];
  const hourlyAvailable = Date.parse(range.to) - Date.parse(range.from) <= 31 * 86400000;
  const bucket = chartInterval === "hour" && hourlyAvailable ? "hour" : "day";
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
    const context = { productId: product.id, sourceId, ...range, event: body.event };
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
  const metrics = (
    web
      ? [
          {
            label: "Page views",
            value: number(s?.total),
            detail: "Every visit to a page",
          },
          {
            label: "Unique visitors",
            value: s?.total && !s.visitors ? "—" : number(s?.visitors),
            detail:
              s?.total && !s.visitors ? "No visitor IDs received" : "With an explicit visitor ID",
          },
          {
            label: "Sessions",
            value: s?.total && !s.sessions ? "—" : number(s?.sessions),
            detail: "Distinct visitor + session pairs",
          },
          {
            label: "Views per session",
            value: s?.sessions ? number((s?.session_views ?? 0) / s.sessions, 1) : "—",
            detail: "Views with an explicit session ID",
          },
        ]
      : tool
        ? [
            {
              label: "Command executions",
              value: number(s?.total),
              detail: "Across all commands",
            },
            {
              label: "Active installations",
              value: s?.total && !s.installations ? "—" : number(s?.installations),
              detail: "With an explicit installation ID",
            },
            {
              label: "Success rate",
              value: s?.success_rate == null ? "—" : `${number(s.success_rate, 1)}%`,
              detail: "Commands reporting success",
            },
            {
              label: "Average duration",
              value: s?.avg_duration == null ? "—" : `${number(s.avg_duration)} ms`,
              detail: `p95 · ${number(s?.p95_duration)} ms`,
            },
          ]
        : [
            {
              label: "Events",
              value: number(s?.total),
              detail: source ? "Events from this source" : "All sources, one project",
            },
            {
              label: "Identified actors",
              value: mobile && s?.total && !s.actors ? "—" : number(s?.actors),
              detail:
                mobile && s?.total && !s.actors
                  ? "No actor IDs received"
                  : "Identity kinds counted separately",
            },
            {
              label: "Website visitors",
              value: number(s?.visitors),
              detail: "Explicit visitor identities",
            },
            {
              label: "Installations",
              value: number(s?.installations),
              detail: "Explicit installation identities",
            },
          ]
  ).slice(0, mobile ? 2 : 4);
  const chart = (
    <SeriesChart
      data={chartResult.data}
      title="Activity over time"
      description={
        choice.measure === "actors"
          ? `${choice.identity_kind === "visitor" ? "Visitors" : choice.identity_kind === "installation" ? "Installations" : "Identities"} counted once per ${bucket}.`
          : choice.unit
            ? `${choice.measure === "p95" ? "95th-percentile" : "Average"} execution time per ${bucket}, in milliseconds.`
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
            value={choice.id}
            onValueChange={setChartMetric}
            options={choices.map((option) => [option.id, option.label])}
          />
          <ValueSelect
            label="Chart interval"
            value={bucket}
            onValueChange={setChartInterval}
            options={
              hourlyAvailable
                ? [
                    ["day", "Daily"],
                    ["hour", "Hourly"],
                  ]
                : [["day", "Daily"]]
            }
          />
        </div>
      }
    />
  );
  return (
    <>
      <PageHeader
        title={source ? `${product.name} / ${source.name}` : product.name}
        description={
          web
            ? "Page views, visitors, and how people find your website."
            : tool
              ? "See how your tool performs in the hands of developers."
              : "Event activity across your project."
        }
      >
        <div className="heading-actions">
          <Badge variant="outline">
            <ProductIcon kind={dashboardKind} />
            {web
              ? "Website"
              : tool
                ? "Developer tool"
                : dashboardKind === "mobile"
                  ? "Mobile app"
                  : "Project"}
          </Badge>
          <Button variant="outline" asChild>
            <Link to="/explore">
              Explore events
              <HugeiconsIcon
                icon={ArrowRight02Icon}
                strokeWidth={2}
                aria-hidden="true"
                data-icon="inline-end"
              />
            </Link>
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
            {s?.total === 0 ? (
              <NoEvents />
            ) : (
              <>
                {chart}
                <div className="breakdowns">
                  <Breakdown
                    title={web ? "Top pages" : tool ? "Top commands" : "Top events"}
                    description={
                      web
                        ? "Page views by path"
                        : tool
                          ? "What developers reach for most"
                          : "Events ranked by count"
                    }
                    groups={query.data.groups}
                    total={s?.total}
                    drilldown={(group) => drilldown(body.group_by, group)}
                  />
                  <Tabs value={dimension} onValueChange={setDimension}>
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          {web
                            ? "Acquisition"
                            : tool
                              ? "Environment"
                              : mobile
                                ? "App activity"
                                : "Sources"}
                        </CardTitle>
                        <CardDescription>
                          {web
                            ? "How visitors find your website"
                            : tool
                              ? "Where your tool is running"
                              : mobile
                                ? "Screens and app versions"
                                : "Where events are collected"}
                        </CardDescription>
                        <TabsList
                          variant="line"
                          aria-label={
                            web
                              ? "Acquisition breakdown"
                              : tool
                                ? "Environment breakdown"
                                : mobile
                                  ? "App breakdown"
                                  : "Source breakdown"
                          }
                          className="breakdown-tabs"
                        >
                          {dimensions.map(([value, label]) => (
                            <TabsTrigger key={value} value={value}>
                              {label}
                            </TabsTrigger>
                          ))}
                        </TabsList>
                      </CardHeader>
                      <TabsContent value={dimension}>
                        <CardContent>
                          {secondary.error && !secondary.data ? (
                            <ErrorState message={secondary.error} retry={refresh} />
                          ) : secondary.loading ? (
                            <BreakdownLoading />
                          ) : (
                            <BreakdownRows
                              title={
                                dimensions.find(([value]) => value === dimension)?.[1] ?? "Sources"
                              }
                              groups={
                                secondaryGroup === "source_id"
                                  ? sourceGroups(secondary.data?.groups ?? [], product.sources)
                                  : (secondary.data?.groups ?? [])
                              }
                              total={secondary.data?.summary.total}
                              drilldown={(group) => drilldown(secondaryGroup, group)}
                            />
                          )}
                        </CardContent>
                      </TabsContent>
                    </Card>
                  </Tabs>
                </div>
                <div className="insight-note">
                  <span className="status-dot" />
                  {product.retention_days}-day retention<span>·</span>
                  {web
                    ? "Visitors are counted only when a visitor ID is sent."
                    : tool
                      ? "Installations are counted only when an installation ID is sent."
                      : "No identity is inferred from IP addresses or user agents."}
                  <Link to="/settings">
                    Manage collection
                    <HugeiconsIcon icon={ArrowRight02Icon} strokeWidth={2} aria-hidden="true" />
                  </Link>
                </div>
              </>
            )}
          </>
        )
      )}
    </>
  );
}
