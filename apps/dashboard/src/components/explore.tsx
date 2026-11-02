import { workspaceTarget } from "@/lib/workspace-route";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearch, useNavigate } from "@tanstack/react-router";
import { defaultSpec, type ExploreSpec as Spec, type ExploreDrilldown } from "@/lib/explore-search";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, FilterHorizontalIcon, PlayIcon } from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ValueSelect } from "./value-select";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { number, sourceGroups, type QueryResult } from "@/lib/api";
import { EventStream } from "./event-stream";
import { useQuery } from "@/lib/use-query";
import { useWorkspace, useAnalyticsPending, PageHeader, NoProduct } from "./app-shell";
import { Breakdown, ErrorState, NoEvents, SeriesChart } from "./shared";
import { ExploreLoading } from "./loading";
import { Spinner } from "@/components/ui/spinner";
export function Explore() {
  const { product, sourceId } = useWorkspace();
  const { drilldown, invalidDrilldown, invalidQuery } = useSearch({ strict: false });
  if (
    invalidQuery ||
    invalidDrilldown ||
    (drilldown && (!product || (drilldown.sourceId && !sourceId)))
  )
    return (
      <>
        <PageHeader
          title="This selection is unavailable"
          description={
            invalidDrilldown || invalidQuery
              ? "The link contains an invalid project, date range, or filter. Clear it to explore your projects."
              : "The project or source in this link is not available in this workspace."
          }
        />
        <Button
          variant="outline"
          nativeButton={false}
          role="link"
          render={<Link {...workspaceTarget("/explore", product?.slug)} search={{}} />}
        >
          Clear selection
        </Button>
      </>
    );
  return product ? (
    <ExploreProduct
      key={`${product.id}:${sourceId ?? "all"}:${JSON.stringify(drilldown)}`}
      drilldown={drilldown}
    />
  ) : (
    <NoProduct />
  );
}
function ExploreProduct({ drilldown }: { drilldown?: ExploreDrilldown }) {
  const { product, source, sourceId, range, refresh, refreshKey } = useWorkspace();
  const search = useSearch({ strict: false });
  const navigate = useNavigate({ from: "/projects/$projectSlug/explore" });
  const applied: Spec = search.query ?? {
    ...defaultSpec,
    event: drilldown?.event ?? "",
    source: drilldown?.source ?? "",
    filterProperty: drilldown?.filter?.property ?? "",
    filterValue: drilldown?.filter ? JSON.stringify(drilldown.filter.value) : "",
  };
  const appliedKey = JSON.stringify(applied);
  const [draft, setDraft] = useState<Spec>(applied);
  const [showFilter, setShowFilter] = useState(!!applied.filterProperty);
  useEffect(() => {
    const applied: Spec = JSON.parse(appliedKey);
    setDraft(applied);
    setShowFilter(!!applied.filterProperty);
  }, [appliedKey]);
  const setApplied = (next: Spec | ((value: Spec) => Spec)) => {
    const query = typeof next === "function" ? next(applied) : next;
    void navigate({ search: (previous) => ({ ...previous, query, page: 1 }), resetScroll: false });
  };
  // A rolling end time advances without changing the chosen interval or URL.
  const rangeKey = drilldown || search.snapshot ? `${range.from}:${range.to}` : range.from;
  const pageSize = search.pageSize ?? 15;
  const page = (search.page ?? 1) - 1;
  const setPage = (page: number) =>
    void navigate({ search: (previous) => ({ ...previous, page: page + 1 }), resetScroll: false });
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
  const scopeKey = JSON.stringify([product?.id, sourceId, rangeKey, applied]);
  const query = useQuery(
    product?.id,
    {
      ...range,
      source_id: sourceId,
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
        description={`Query and inspect activity from ${source ? `${product?.name} / ${source.name}` : product?.name}.`}
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
                  Client · {applied.source}
                  <button
                    type="button"
                    aria-label="Remove client filter"
                    onClick={() => {
                      setDraft((d) => ({ ...d, source: "" }));
                      setApplied((d) => ({ ...d, source: "" }));
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
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            role="link"
            render={<Link {...workspaceTarget("/explore", product?.slug)} search={{}} />}
          >
            <HugeiconsIcon
              icon={Cancel01Icon}
              strokeWidth={2}
              aria-hidden="true"
              data-icon="inline-start"
            />
            Clear selection
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
                      ["source_id", "Source"],
                      ["source", "Client"],
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
                  <CollapsibleTrigger render={<Button type="button" variant="outline" />}>
                    <HugeiconsIcon
                      icon={FilterHorizontalIcon}
                      strokeWidth={2}
                      aria-hidden="true"
                      data-icon="inline-start"
                    />
                    Filter{applied.filterProperty ? " · 1" : ""}
                  </CollapsibleTrigger>
                  <Button
                    type="submit"
                    aria-label="Run query"
                    aria-busy={query.loading}
                    disabled={query.loading}
                  >
                    {query.loading ? (
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
                    groups={
                      applied.group === "source_id"
                        ? sourceGroups(data.groups, product?.sources)
                        : data.groups
                    }
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
                    void navigate({
                      search: (previous) => ({ ...previous, pageSize: size, page: 1 }),
                      resetScroll: false,
                    });
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
