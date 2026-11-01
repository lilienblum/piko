import { useMemo, useState } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import type { ExploreDrilldown } from "@/lib/explore-search";
import { ChevronLeft, ChevronRight, Filter, Play, X } from "lucide-react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ValueSelect } from "./value-select";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { number, type EventRow } from "@/lib/api";
import { useQuery } from "@/lib/use-query";
import { useWorkspace, PageHeader, NoProduct } from "./app-shell";
import { Breakdown, ErrorState, Loading, NoEvents, SeriesChart } from "./shared";
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
  const { product, range, refresh, refreshKey } = useWorkspace();
  const initial: Spec = {
    ...defaultSpec,
    event: drilldown?.event ?? "",
    source: drilldown?.source ?? "",
    filterProperty: drilldown?.filter?.property ?? "",
    filterValue: drilldown?.filter ? JSON.stringify(drilldown.filter.value) : "",
  };
  const [draft, setDraft] = useState<Spec>(initial);
  const [applied, setApplied] = useState<Spec>(initial);
  const rangeKey = `${range.from}:${range.to}`;
  const [pagination, setPagination] = useState({ rangeKey, page: 0 });
  const page = pagination.rangeKey === rangeKey ? pagination.page : 0;
  const setPage = (next: number | ((current: number) => number)) => {
    setPagination({ rangeKey, page: typeof next === "function" ? next(page) : next });
  };
  const [showFilter, setShowFilter] = useState(!!drilldown?.filter);
  const [validation, setValidation] = useState("");
  const [selected, setSelected] = useState<EventRow | null>(null);
  const filters = useMemo(() => {
    if (!applied.filterProperty) return [];
    let value: unknown = applied.filterValue;
    try {
      value = JSON.parse(applied.filterValue);
    } catch {}
    return [{ property: applied.filterProperty, op: applied.filterOp, value }];
  }, [applied]);
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
      page_size: 15,
    },
    refreshKey,
  );
  const columns = useMemo<ColumnDef<EventRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Event",
        cell: ({ row }) => (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto px-0"
            onClick={() => setSelected(row.original)}
          >
            {row.original.name}
            <ChevronRight data-icon="inline-end" />
          </Button>
        ),
      },
      {
        accessorKey: "source",
        header: "Source",
        cell: ({ row }) => <Badge variant="secondary">{row.original.source}</Badge>,
      },
      {
        accessorKey: "actor_id",
        header: "Identity",
        cell: ({ row }) => (
          <span className="identity-cell">
            {row.original.actor_id ? (
              <>
                <span>{row.original.identity_kind}</span>
                <code title={row.original.actor_id}>{row.original.actor_id.slice(0, 16)}</code>
              </>
            ) : (
              "Anonymous"
            )}
          </span>
        ),
      },
      {
        accessorKey: "properties",
        header: "Properties",
        cell: ({ row }) => (
          <span className="property-preview" title={JSON.stringify(row.original.properties)}>
            {Object.entries(row.original.properties)
              .slice(0, 3)
              .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
              .join(" · ")}
          </span>
        ),
      },
      {
        accessorKey: "timestamp",
        header: "Time (UTC)",
        cell: ({ row }) => (
          <time>
            {new Date(row.original.timestamp).toLocaleString("en-GB", {
              timeZone: "UTC",
              month: "short",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        ),
      },
    ],
    [],
  );
  const table = useReactTable({
    data: query.data?.events ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    rowCount: query.data?.summary.total ?? 0,
    state: { pagination: { pageIndex: page, pageSize: 15 } },
  });
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
        title="Follow your curiosity"
        description={`Ask a question of ${product?.name}. Start with an event, then look a little closer.`}
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
                    <X className="size-3" />
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
              <X data-icon="inline-start" />
              Clear selection
            </Link>
          </Button>
        </section>
      )}
      <Card className="query-builder">
        <CardHeader>
          <div className="card-heading">
            <CardTitle>Build a query</CardTitle>
            <Badge variant="secondary">{product?.name}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <form
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
                          ...(query.data?.event_names ?? []),
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
                      <Filter data-icon="inline-start" />
                      Filter{applied.filterProperty ? " · 1" : ""}
                    </Button>
                  </CollapsibleTrigger>
                  <Button type="submit">
                    <Play data-icon="inline-start" />
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
                    <X />
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
      {query.error ? (
        <ErrorState message={query.error} retry={refresh} />
      ) : query.loading ? (
        <Loading />
      ) : (
        query.data && (
          <>
            <div className="explore-summary">
              <span>{measureLabels[applied.measure]}</span>
              <strong>
                {number(query.data.summary.value, 2)}
                {applied.property === "duration_ms" &&
                !["count", "actors"].includes(applied.measure)
                  ? " ms"
                  : ""}
              </strong>
              <span>across {number(query.data.summary.total)} matching events</span>
            </div>
            {query.data.summary.total === 0 ? (
              <NoEvents />
            ) : (
              <>
                <div className="explore-charts">
                  <SeriesChart
                    data={query.data}
                    title="Results over time"
                    description="UTC daily buckets · missing numeric values are excluded"
                    label={measureLabels[applied.measure]}
                  />
                  <Breakdown
                    title="Breakdown"
                    description={`Grouped by ${applied.group.replace("property:", "")}`}
                    groups={query.data.groups}
                    unit="Value"
                  />
                </div>
                <Card className="event-card">
                  <CardHeader>
                    <div className="card-heading">
                      <div>
                        <CardTitle>Event stream</CardTitle>
                        <CardDescription>
                          Click an event to inspect its typed properties.
                        </CardDescription>
                      </div>
                      <Badge variant="outline">{number(query.data.summary.total)} events</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        {table.getHeaderGroups().map((group) => (
                          <TableRow key={group.id}>
                            {group.headers.map((header) => (
                              <TableHead key={header.id}>
                                {flexRender(header.column.columnDef.header, header.getContext())}
                              </TableHead>
                            ))}
                          </TableRow>
                        ))}
                      </TableHeader>
                      <TableBody>
                        {table.getRowModel().rows.map((row) => (
                          <TableRow key={row.id}>
                            {row.getVisibleCells().map((cell) => (
                              <TableCell key={cell.id}>
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="pagination">
                      <span>
                        Page {page + 1} of {Math.max(1, Math.ceil(query.data.summary.total / 15))}
                      </span>
                      <div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={page === 0}
                          onClick={() => setPage((p) => p - 1)}
                        >
                          <ChevronLeft data-icon="inline-start" />
                          Previous
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={(page + 1) * 15 >= query.data.summary.total}
                          onClick={() => setPage((p) => p + 1)}
                        >
                          Next
                          <ChevronRight data-icon="inline-end" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="event-dialog">
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
            <DialogDescription>
              Event properties retain their original JSON types.
            </DialogDescription>
          </DialogHeader>
          <pre>{JSON.stringify(selected, null, 2)}</pre>
        </DialogContent>
      </Dialog>
    </>
  );
}
