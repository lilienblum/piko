import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import type { ExploreDrilldown } from "@/lib/explore-search";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  FilterHorizontalIcon,
  PlayIcon,
  RefreshIcon,
} from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ValueSelect } from "./value-select";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { number, type QueryResult } from "@/lib/api";
import { EventStream } from "./event-stream";
import { useQuery } from "@/lib/use-query";
import { useWorkspace, useAnalyticsPending, PageHeader, NoProduct } from "./app-shell";
import { Breakdown, ErrorState, NoEvents, SeriesChart } from "./shared";
import { ExploreLoading } from "./loading";
import { Spinner } from "@/components/ui/spinner";
type Spec = {
  event: string;
  source: string;
  measure: string;
  property: string;
  group: string;
  filterProperty: string;
  filterOp: string;
  filterValue: string;
};
const defaultSpec: Spec = {
  event: "",
  source: "",
  measure: "count",
  property: "duration_ms",
  group: "name",
  filterProperty: "",
  filterOp: "eq",
  filterValue: "",
};
export function Explore() {
  const { product } = useWorkspace();
  const { drilldown, invalidDrilldown } = useSearch({ from: "/explore" });
  if (invalidDrilldown || (drilldown && !product))
    return (
      <>
        <PageHeader
          title="This selection is unavailable"
          description={
            invalidDrilldown
              ? "The link contains an invalid product, date range, or filter. Clear it to explore your products."
              : "The product in this link no longer exists in this workspace."
          }
        />
        <Button asChild variant="outline">
          <Link to="/explore" search={{}}>
            Clear selection
          </Link>
        </Button>
      </>
    );
  return product ? (
    <ExploreProduct key={`${product.id}:${JSON.stringify(drilldown)}`} drilldown={drilldown} />
  ) : (
    <NoProduct />
  );
}
function ExploreProduct({ drilldown }: { drilldown?: ExploreDrilldown }) {
  const { product, range, refresh, refreshKey, hasUpdates } = useWorkspace();
  const initial: Spec = {
    ...defaultSpec,
    event: drilldown?.event ?? "",
    source: drilldown?.source ?? "",
    filterProperty: drilldown?.filter?.property ?? "",
    filterValue: drilldown?.filter ? JSON.stringify(drilldown.filter.value) : "",
  };
  const [draft, setDraft] = useState<Spec>(initial);
  const [applied, setApplied] = useState<Spec>(initial);
  // A rolling end time advances on refresh without changing the selected interval.
  const rangeKey = drilldown ? `${range.from}:${range.to}` : range.from;
  const [pageSize, setPageSize] = useState(15);
  const [pagination, setPagination] = useState({ rangeKey, page: 0 });
  const page = pagination.rangeKey === rangeKey ? pagination.page : 0;
  const setPage = (next: number | ((current: number) => number)) => {
    setPagination({ rangeKey, page: typeof next === "function" ? next(page) : next });
  };
  const [showFilter, setShowFilter] = useState(!!drilldown?.filter);
  const [validation, setValidation] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const retry = () => setRetryKey((key) => key + 1);
  const filters = useMemo(() => {
    if (!applied.filterProperty) return [];
    let value: unknown = applied.filterValue;
    try {
      value = JSON.parse(applied.filterValue);
    } catch {}
    return [{ property: applied.filterProperty, op: applied.filterOp, value }];
  }, [applied]);
  const scopeKey = JSON.stringify([product?.id, rangeKey, applied]);
  const query = useQuery(
    product?.id,
    {
      ...range,
      event: applied.event || undefined,
      source: applied.source || undefined,
      measure: applied.measure,
      property: applied.property,
      group_by: applied.group,
      filters,
      page,
      page_size: pageSize,
    },
    `${refreshKey}:${retryKey}`,
    `${scopeKey}:${page}:${pageSize}`,
  );
  useAnalyticsPending(query.refreshing);
  const [lastResult, setLastResult] = useState<{ scope: string; data: QueryResult }>();
  useEffect(() => {
    if (query.data) setLastResult({ scope: scopeKey, data: query.data });
  }, [query.data, scopeKey]);
  const data = query.data ?? (lastResult?.scope === scopeKey ? lastResult.data : undefined);
  const update = (key: keyof Spec, value: string) => setDraft((d) => ({ ...d, [key]: value }));
  const measureLabels: Record<string, string> = {
    count: "Event count",
    actors: "Distinct actors",
    sum: "Numeric sum",
    avg: "Numeric average",
    p50: "Duration p50",
    p95: "Duration p95",
  };
  return (
    <>
      <PageHeader
        title="Explore events"
        description={`Query and inspect activity from ${product?.name}.`}
      />
      {drilldown && (
        <section className="drilldown-context" aria-label="Overview selection">
          <div>
            <strong>Overview selection</strong>
            <p className="drilldown-range">
              <time dateTime={range.from} title={range.from}>
                {new Date(range.from).toLocaleString("en-GB", {
                  timeZone: "UTC",
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </time>
              {" to "}
              <time dateTime={range.to} title={range.to}>
                {new Date(range.to).toLocaleString("en-GB", {
                  timeZone: "UTC",
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </time>
              {" UTC"}
            </p>
            <div className="drilldown-filters">
              {applied.event && <Badge variant="outline">Event · {applied.event}</Badge>}
              {applied.source && (
                <Badge variant="outline">
                  Source · {applied.source}
                  <button
                    type="button"
                    aria-label="Remove source filter"
                    onClick={() => {
                      setDraft((d) => ({ ...d, source: "" }));
                      setApplied((d) => ({ ...d, source: "" }));
                      setPage(0);
                    }}
                  >
                    <HugeiconsIcon
                      icon={Cancel01Icon}
                      strokeWidth={2}
                      aria-hidden="true"
                      className="size-3"
                    />
                  </button>
                </Badge>
              )}
              {applied.filterProperty && (
                <Badge variant="outline" className="drilldown-property">
                  {applied.filterProperty} {applied.filterOp === "eq" ? "=" : applied.filterOp}{" "}
                  {applied.filterValue}
                </Badge>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/explore" search={{}}>
              <HugeiconsIcon
                icon={Cancel01Icon}
                strokeWidth={2}
                aria-hidden="true"
                data-icon="inline-start"
              />
              Clear selection
            </Link>
          </Button>
        </section>
      )}
      <Card className="query-builder">
        <CardContent>
          <form
            aria-label="Build a query"
            onSubmit={(e) => {
              e.preventDefault();
              setValidation("");
              if (draft.filterProperty && !draft.filterValue) {
                setValidation("Enter a filter value. Use true, 42, or a string.");
                return;
              }
              setApplied({ ...draft });
              setPage(0);
              refresh();
            }}
          >
            <Collapsible open={showFilter} onOpenChange={setShowFilter}>
              <FieldGroup className="query-controls">
                <Field>
                  <FieldLabel htmlFor="event">Event</FieldLabel>
                  <ValueSelect
                    id="event"
                    value={draft.event || "*"}
                    onValueChange={(value) => update("event", value === "*" ? "" : value)}
                    options={[
                      ["*", "All events"],
                      ...Array.from(
                        new Set([
                          ...(data?.event_names ?? []),
                          ...(draft.event ? [draft.event] : []),
                        ]),
                      ).map((name): [string, string] => [name, name]),
                    ]}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="measure">Measure</FieldLabel>
                  <ValueSelect
                    id="measure"
                    value={draft.measure}
                    onValueChange={(value) => {
                      update("measure", value);
                      if (value.startsWith("p")) update("property", "duration_ms");
                    }}
                    options={Object.entries(measureLabels)}
                  />
                </Field>
                {!["count", "actors"].includes(draft.measure) && (
                  <Field>
                    <FieldLabel htmlFor="measure-property">Numeric property</FieldLabel>
                    <Input
                      id="measure-property"
                      value={draft.property}
                      onChange={(e) => update("property", e.target.value)}
                      required
                    />
                  </Field>
                )}
                <Field>
                  <FieldLabel htmlFor="group">Group by</FieldLabel>
                  <ValueSelect
                    id="group"
                    value={draft.group}
                    onValueChange={(value) => update("group", value)}
                    options={[
                      ["name", "Event name"],
                      ["source", "Source"],
                      ["identity_kind", "Identity kind"],
                      ["property:path", "Page path"],
                      ["property:referrer", "Referrer"],
                      ["property:utm_source", "Campaign source"],
                      ["property:utm_campaign", "Campaign"],
                      ["property:command", "Command"],
                      ["property:os", "OS"],
                      ["property:version", "Version"],
                      ["property:arch", "Architecture"],
                      ["property:success", "Success"],
                    ]}
                  />
                </Field>
                <div className="query-actions">
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="outline">
                      <HugeiconsIcon
                        icon={FilterHorizontalIcon}
                        strokeWidth={2}
                        aria-hidden="true"
                        data-icon="inline-start"
                      />
                      Filter{applied.filterProperty ? " · 1" : ""}
                    </Button>
                  </CollapsibleTrigger>
                  <Button
                    type="submit"
                    aria-label="Run query"
                    aria-busy={query.refreshing}
                    disabled={query.refreshing}
                  >
                    {query.refreshing ? (
                      <Spinner data-icon="inline-start" aria-hidden="true" />
                    ) : (
                      <HugeiconsIcon
                        icon={PlayIcon}
                        strokeWidth={2}
                        aria-hidden="true"
                        data-icon="inline-start"
                      />
                    )}
                    Run query
                  </Button>
                </div>
              </FieldGroup>
              <CollapsibleContent>
                <FieldGroup className="filter-controls">
                  <Field>
                    <FieldLabel htmlFor="filter-property">Property</FieldLabel>
                    <Input
                      id="filter-property"
                      placeholder="e.g. success"
                      value={draft.filterProperty}
                      onChange={(e) => update("filterProperty", e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="filter-op">Condition</FieldLabel>
                    <ValueSelect
                      id="filter-op"
                      value={draft.filterOp}
                      onValueChange={(value) => update("filterOp", value)}
                      options={[
                        ["eq", "equals"],
                        ["ne", "does not equal"],
                        ["gt", "greater than"],
                        ["gte", "at least"],
                        ["lt", "less than"],
                        ["lte", "at most"],
                      ]}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="filter-value">Typed value</FieldLabel>
                    <Input
                      id="filter-value"
                      placeholder={'true, 42, or "build"'}
                      value={draft.filterValue}
                      onChange={(e) => update("filterValue", e.target.value)}
                    />
                  </Field>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove filter"
                    onClick={() => {
                      setDraft((d) => ({ ...d, filterProperty: "", filterValue: "" }));
                      setApplied((d) => ({ ...d, filterProperty: "", filterValue: "" }));
                      setPage(0);
                      setShowFilter(false);
                    }}
                  >
                    <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} aria-hidden="true" />
                  </Button>
                </FieldGroup>
              </CollapsibleContent>
            </Collapsible>
            {validation && (
              <p role="alert" className="form-error">
                {validation}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
      {query.error && !data ? (
        <ErrorState message={query.error} retry={retry} />
      ) : !data ? (
        <ExploreLoading />
      ) : (
        data && (
          <>
            {query.error && query.data && <ErrorState message={query.error} retry={retry} />}
            <div className="explore-summary">
              <div className="explore-summary-value">
                <span>{measureLabels[applied.measure]}</span>
                <strong>
                  {number(data.summary.value, 2)}
                  {applied.property === "duration_ms" &&
                  !["count", "actors"].includes(applied.measure)
                    ? " ms"
                    : ""}
                </strong>
                <span>across {number(data.summary.total)} matching events</span>
              </div>
              <Button
                variant={hasUpdates ? "secondary" : "outline"}
                size="sm"
                className="w-40 text-xs"
                aria-label="Refresh results"
                aria-busy={query.refreshing}
                disabled={query.refreshing}
                onClick={refresh}
              >
                {query.refreshing ? (
                  <Spinner data-icon="inline-start" aria-hidden="true" />
                ) : hasUpdates ? (
                  <span className="live-dot" aria-hidden="true" />
                ) : (
                  <HugeiconsIcon
                    icon={RefreshIcon}
                    strokeWidth={2}
                    data-icon="inline-start"
                    aria-hidden="true"
                  />
                )}
                <span role="status">{hasUpdates ? "New data available" : "Refresh results"}</span>
              </Button>
            </div>
            {data.summary.total === 0 ? (
              <NoEvents />
            ) : (
              <>
                <div className="explore-charts">
                  <SeriesChart
                    data={data}
                    title="Results over time"
                    description={
                      ["count", "actors"].includes(applied.measure)
                        ? "UTC daily buckets"
                        : "UTC daily buckets · missing numeric values are excluded"
                    }
                    label={measureLabels[applied.measure]}
                  />
                  <Breakdown
                    title="Breakdown"
                    description={`Grouped by ${applied.group.replace("property:", "")}`}
                    groups={data.groups}
                    unit="Value"
                  />
                </div>
                <EventStream
                  key={scopeKey}
                  events={query.data?.events ?? []}
                  total={data.summary.total}
                  page={page}
                  pageSize={pageSize}
                  loading={query.loading}
                  refreshing={query.refreshing}
                  error={query.data ? undefined : query.error}
                  onRetry={retry}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(0);
                  }}
                  onFilterProperty={(property, value) => {
                    const next = {
                      ...applied,
                      filterProperty: property,
                      filterOp: "eq",
                      filterValue: JSON.stringify(value),
                    };
                    setDraft(next);
                    setApplied(next);
                    setValidation("");
                    setShowFilter(true);
                    setPage(0);
                    requestAnimationFrame(() => document.getElementById("filter-value")?.focus());
                  }}
                />
              </>
            )}
          </>
        )
      )}
    </>
  );
}
