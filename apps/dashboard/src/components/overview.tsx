import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Clock3,
  Eye,
  Fingerprint,
  MousePointer2,
  Terminal,
  Users,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@/lib/use-query";
import { number } from "@/lib/api";
import { useWorkspace, PageHeader, NoProduct, ProductIcon } from "./app-shell";
import { Breakdown, ErrorState, Loading, NoEvents, SeriesChart } from "./shared";
export function Overview() {
  const { product, range, refresh } = useWorkspace();
  const web = product?.kind === "website";
  const tool = product?.kind === "tool";
  const body = {
    ...range,
    event: web ? "page_view" : tool ? "command_run" : undefined,
    measure: "count",
    group_by: web ? "property:path" : tool ? "property:command" : "name",
  };
  const query = useQuery(product?.id, body);
  const secondary = useQuery(product?.id, {
    ...body,
    group_by: web ? "property:referrer" : tool ? "property:os" : "source",
  });
  if (!product) return <NoProduct />;
  const s = query.data?.summary;
  const metrics = web
    ? [
        {
          label: "Page views",
          value: number(s?.total),
          detail: "Every visit to a page",
          icon: Eye,
        },
        {
          label: "Unique visitors",
          value: s?.total && !s.visitors ? "—" : number(s?.visitors),
          detail:
            s?.total && !s.visitors ? "No visitor IDs received" : "With an explicit visitor ID",
          icon: Users,
        },
        {
          label: "Sessions",
          value: s?.total && !s.sessions ? "—" : number(s?.sessions),
          detail: "Distinct visitor + session pairs",
          icon: MousePointer2,
        },
        {
          label: "Views per session",
          value: s?.sessions ? number((s?.session_views ?? 0) / s.sessions, 1) : "—",
          detail: "Views with an explicit session ID",
          icon: Zap,
        },
      ]
    : tool
      ? [
          {
            label: "Command executions",
            value: number(s?.total),
            detail: "Across all commands",
            icon: Terminal,
          },
          {
            label: "Active installations",
            value: s?.total && !s.installations ? "—" : number(s?.installations),
            detail: "With an explicit installation ID",
            icon: Fingerprint,
          },
          {
            label: "Success rate",
            value: s?.success_rate == null ? "—" : `${number(s.success_rate, 1)}%`,
            detail: "Commands reporting success",
            icon: Zap,
          },
          {
            label: "Average duration",
            value: s?.avg_duration == null ? "—" : `${number(s.avg_duration)} ms`,
            detail: `p95 · ${number(s?.p95_duration)} ms`,
            icon: Clock3,
          },
        ]
      : [
          {
            label: "Events",
            value: number(s?.total),
            detail: "All sources, one product",
            icon: Zap,
          },
          {
            label: "Identified actors",
            value: number(s?.actors),
            detail: "Identity kinds counted separately",
            icon: Users,
          },
          {
            label: "Website visitors",
            value: number(s?.visitors),
            detail: "Explicit visitor identities",
            icon: Eye,
          },
          {
            label: "Installations",
            value: number(s?.installations),
            detail: "Explicit installation identities",
            icon: Terminal,
          },
        ];
  return (
    <>
      <PageHeader
        title={product.name}
        description={
          web
            ? "Understand where people go, and what brings them back."
            : tool
              ? "See how your tool performs in the hands of developers."
              : "Every interaction, brought into focus."
        }
      >
        <div className="heading-actions">
          <Badge variant="outline">
            <ProductIcon kind={product.kind} />
            {web ? "Website" : tool ? "Developer tool" : "Product"}
          </Badge>
          <Button variant="outline" asChild>
            <Link to="/explore">
              Explore events
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </PageHeader>
      {query.error ? (
        <ErrorState message={query.error} retry={refresh} />
      ) : query.loading ? (
        <Loading />
      ) : (
        query.data && (
          <>
            <div className="metrics">
              {metrics.map((m) => (
                <Card key={m.label} className="metric-card">
                  <CardContent>
                    <div className="metric-label">
                      {m.label}
                      <m.icon />
                    </div>
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
                <SeriesChart
                  data={query.data}
                  title={
                    web ? "Page views over time" : tool ? "Command activity" : "Product activity"
                  }
                  description="Daily activity across the selected period"
                  label={web ? "Page views" : tool ? "Executions" : "Events"}
                />
                <div className="breakdowns">
                  <Breakdown
                    title={web ? "Top pages" : tool ? "Top commands" : "Top events"}
                    description={
                      web
                        ? "The places people spend their time"
                        : tool
                          ? "What developers reach for most"
                          : "The interactions that matter"
                    }
                    groups={query.data.groups}
                  />
                  {secondary.error ? (
                    <ErrorState message={secondary.error} retry={refresh} />
                  ) : (
                    <Breakdown
                      title={web ? "Referrers" : tool ? "Operating systems" : "Sources"}
                      description={
                        web
                          ? "Where your visitors come from"
                          : tool
                            ? "Where your tool is running"
                            : "Where events are collected"
                      }
                      groups={secondary.data?.groups ?? []}
                    />
                  )}
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
                    <ArrowRight />
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
