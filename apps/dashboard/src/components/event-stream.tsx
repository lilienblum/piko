import { useEffect, useMemo, useRef, useState } from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  CommandLineIcon,
  Copy01Icon,
  CubeIcon,
  FilterHorizontalIcon,
  Globe02Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { number, type EventRow, type Properties } from "@/lib/api";
import { ErrorState } from "./shared";
import { ValueSelect } from "./value-select";

type EventStreamProps = {
  events: EventRow[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  refreshing?: boolean;
  error?: string;
  onRetry: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onFilterProperty: (property: string, value: Properties[string]) => void;
};

function EventContext({ event }: { event: EventRow }) {
  const p = event.properties;
  const main =
    typeof p.path === "string" ? p.path : typeof p.command === "string" ? p.command : undefined;
  const extra =
    typeof p.path === "string"
      ? typeof p.referrer === "string"
        ? `From ${p.referrer || "empty referrer"}`
        : undefined
      : typeof p.command === "string" && typeof p.version === "string"
        ? `v${p.version}`
        : undefined;
  const fallback = Object.entries(p)
    .slice(0, 2)
    .map(([key, value]) => `${key} = ${JSON.stringify(value)}`)
    .join(" · ");
  return (
    <div className="stream-context">
      <code title={main ?? fallback}>
        {main === "" ? '""' : (main ?? (fallback || "No properties"))}
      </code>
      <div className="stream-context-details">
        {typeof p.success === "boolean" && (
          <Badge variant={p.success ? "secondary" : "destructive"}>
            <HugeiconsIcon
              icon={p.success ? Tick01Icon : Cancel01Icon}
              strokeWidth={2}
              aria-hidden="true"
            />
            {p.success ? "Success" : "Failed"}
          </Badge>
        )}
        {typeof p.duration_ms === "number" && (
          <span className="stream-duration">{number(p.duration_ms, 2)} ms</span>
        )}
        {extra && (
          <span className="stream-context-extra" title={extra}>
            {extra}
          </span>
        )}
      </div>
    </div>
  );
}

export function EventStream({
  events,
  total,
  page,
  pageSize,
  loading,
  refreshing = false,
  error,
  onRetry,
  onPageChange,
  onPageSizeChange,
  onFilterProperty,
}: EventStreamProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const focusId = useRef<string | null>(null);
  const restoreFocus = useRef(true);
  const selectedIndex = events.findIndex((event) => event.event_id === selectedId);
  const selected = loading ? undefined : events[selectedIndex];
  function selectAdjacent(index: number) {
    const next = events[index];
    if (next) {
      focusId.current = next.event_id;
      setSelectedId(next.event_id);
    }
  }
  useEffect(() => {
    if (loading) setSelectedId(null);
  }, [loading]);
  const columns = useMemo<ColumnDef<EventRow>[]>(
    () => [
      {
        id: "event",
        header: "Event",
        cell: ({ row }) => {
          const event = row.original;
          const icon =
            event.name === "page_view"
              ? Globe02Icon
              : event.name === "command_run"
                ? CommandLineIcon
                : CubeIcon;
          return (
            <div className="stream-event">
              <Button
                variant="ghost"
                size="sm"
                className="stream-inspect"
                aria-label={`Inspect ${event.name}`}
                ref={(button) => {
                  if (button) buttons.current.set(event.event_id, button);
                  else buttons.current.delete(event.event_id);
                }}
                onClick={() => {
                  restoreFocus.current = true;
                  focusId.current = event.event_id;
                  setSelectedId(event.event_id);
                }}
              >
                <HugeiconsIcon
                  icon={icon}
                  strokeWidth={2}
                  aria-hidden="true"
                  data-icon="inline-start"
                />
                <span>{event.name}</span>
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  strokeWidth={2}
                  aria-hidden="true"
                  data-icon="inline-end"
                />
              </Button>
              <div className="stream-event-meta">
                <Badge variant="outline">{event.source}</Badge>
                <time
                  className="stream-mobile-time"
                  dateTime={new Date(event.timestamp).toISOString()}
                  title={new Date(event.timestamp).toISOString()}
                >
                  {new Date(event.timestamp).toLocaleString("en-GB", {
                    timeZone: "UTC",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}{" "}
                  UTC
                </time>
              </div>
            </div>
          );
        },
      },
      {
        id: "context",
        header: "Context",
        cell: ({ row }) => <EventContext event={row.original} />,
      },
      {
        id: "identity",
        header: "Identity",
        cell: ({ row }) => (
          <div className="stream-identity">
            {row.original.actor_id ? (
              <>
                <span>
                  {row.original.identity_kind === "visitor"
                    ? "Visitor"
                    : row.original.identity_kind === "installation"
                      ? "Installation"
                      : "Actor"}
                </span>
                <code title={row.original.actor_id}>{row.original.actor_id}</code>
              </>
            ) : (
              <span>Anonymous</span>
            )}
          </div>
        ),
      },
      {
        id: "time",
        header: "Time (UTC)",
        cell: ({ row }) => (
          <time
            className="stream-time"
            dateTime={new Date(row.original.timestamp).toISOString()}
            title={new Date(row.original.timestamp).toISOString()}
          >
            <span>
              {new Date(row.original.timestamp).toLocaleTimeString("en-GB", { timeZone: "UTC" })}
            </span>
            <span>
              {new Date(row.original.timestamp).toLocaleDateString("en-GB", {
                timeZone: "UTC",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </time>
        ),
      },
    ],
    [],
  );
  const table = useReactTable({
    data: events,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (event) => event.event_id,
    manualPagination: true,
    rowCount: total,
    state: { pagination: { pageIndex: page, pageSize } },
  });
  const pageCount = Math.max(1, Math.min(10001, Math.ceil(total / pageSize)));
  const start = events.length ? page * pageSize + 1 : 0;
  const end = page * pageSize + events.length;
  const pendingRows = Array.from(
    { length: Math.min(pageSize, Math.max(1, total - page * pageSize)) },
    (_, offset) => page * pageSize + offset,
  );
  return (
    <>
      <Card
        className="event-card event-stream"
        aria-label="Event stream"
        aria-busy={loading || refreshing}
      >
        <CardHeader>
          <div className="card-heading">
            <div>
              <CardTitle>Event stream</CardTitle>
              <CardDescription>Newest first · event time in UTC</CardDescription>
            </div>
            <Badge variant="outline">{number(total)} events</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="stream-message">
              <ErrorState message={error} retry={onRetry} />
            </div>
          ) : (
            <Table className="stream-table">
              <TableHeader>
                {table.getHeaderGroups().map((group) => (
                  <TableRow key={group.id}>
                    {group.headers.map((header) => (
                      <TableHead key={header.id} className={`stream-column-${header.column.id}`}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {loading
                  ? pendingRows.map((position) => (
                      <TableRow key={position} aria-hidden="true">
                        {columns.map((column) => (
                          <TableCell key={column.id} className={`stream-column-${column.id}`}>
                            <Skeleton className="h-8 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        data-state={selectedId === row.id ? "selected" : undefined}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className={`stream-column-${cell.column.id}`}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                {!loading && !events.length && (
                  <TableRow>
                    <TableCell colSpan={columns.length}>
                      <Empty>
                        <EmptyHeader>
                          <EmptyTitle>No events on this page</EmptyTitle>
                          <EmptyDescription>
                            The results may have changed since this page was opened.
                          </EmptyDescription>
                        </EmptyHeader>
                        <Button variant="outline" onClick={() => onPageChange(0)}>
                          Return to first page
                        </Button>
                      </Empty>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
        <CardFooter className="stream-footer">
          <div
            className="stream-page-info"
            role="status"
            aria-label={loading ? "Loading events" : "Event pagination"}
          >
            <span>
              {loading
                ? "Loading events…"
                : error
                  ? "Could not load this page"
                  : `Showing ${number(start)}–${number(events.length ? end : 0)} of ${number(total)}`}
            </span>
            <span>
              Page {page + 1} of {pageCount}
            </span>
          </div>
          <div className="stream-page-actions">
            <ValueSelect
              label="Rows per page"
              value={String(pageSize)}
              options={[
                ["15", "15 rows"],
                ["30", "30 rows"],
                ["50", "50 rows"],
              ]}
              disabled={loading || refreshing}
              onValueChange={(value) => onPageSizeChange(Number(value))}
              className="stream-page-size"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={loading || refreshing || page === 0}
              onClick={() => onPageChange(page - 1)}
            >
              <HugeiconsIcon
                icon={ArrowLeft01Icon}
                strokeWidth={2}
                aria-hidden="true"
                data-icon="inline-start"
              />
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={loading || refreshing || page + 1 >= pageCount}
              onClick={() => onPageChange(page + 1)}
            >
              Next
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                strokeWidth={2}
                aria-hidden="true"
                data-icon="inline-end"
              />
            </Button>
          </div>
        </CardFooter>
      </Card>
      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <SheetContent
          className="event-sheet w-full sm:max-w-[600px]"
          showCloseButton={false}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (restoreFocus.current && focusId.current)
              buttons.current.get(focusId.current)?.focus();
          }}
        >
          <SheetHeader className="pr-16">
            <SheetTitle>{selected?.name ?? "Event details"}</SheetTitle>
            <SheetDescription>
              Inspect the captured values and collection metadata.
            </SheetDescription>
            <SheetClose asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close event"
                className="absolute right-4 top-4"
              >
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} aria-hidden="true" />
              </Button>
            </SheetClose>
          </SheetHeader>
          {selected && (
            <>
              <div className="inspector-navigation">
                <span aria-live="polite">
                  Event {selectedIndex + 1} of {events.length} on this page
                </span>
                <div>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Newer event"
                    disabled={selectedIndex === 0}
                    onClick={() => selectAdjacent(selectedIndex - 1)}
                  >
                    <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} aria-hidden="true" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Older event"
                    disabled={selectedIndex + 1 === events.length}
                    onClick={() => selectAdjacent(selectedIndex + 1)}
                  >
                    <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} aria-hidden="true" />
                  </Button>
                </div>
              </div>
              <EventInspector
                key={selected.event_id}
                event={selected}
                onFilter={(property, value) => {
                  restoreFocus.current = false;
                  setSelectedId(null);
                  onFilterProperty(property, value);
                }}
              />
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function EventInspector({
  event,
  onFilter,
}: {
  event: EventRow;
  onFilter: EventStreamProps["onFilterProperty"];
}) {
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<{ error: boolean; message: string }>();
  const properties = Object.entries(event.properties).sort(([a], [b]) => a.localeCompare(b));
  const visible = properties.filter(([key, value]) =>
    `${key} ${JSON.stringify(value)}`.toLowerCase().includes(search.toLowerCase()),
  );
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setFeedback({ error: false, message: "Copied as JSON." });
    } catch {
      setFeedback({
        error: true,
        message: "Could not copy. Select the value and copy it manually.",
      });
    }
  }
  return (
    <Tabs defaultValue="properties" className="inspector-tabs">
      <TabsList aria-label="Event details">
        <TabsTrigger value="properties" aria-label="Properties">
          Properties <Badge variant="secondary">{properties.length}</Badge>
        </TabsTrigger>
        <TabsTrigger value="metadata">Metadata</TabsTrigger>
        <TabsTrigger value="json">JSON</TabsTrigger>
      </TabsList>
      {feedback && (
        <p
          className={feedback.error ? "form-error inspector-feedback" : "inspector-feedback"}
          role={feedback.error ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      )}
      <TabsContent value="properties" className="inspector-panel">
        <Field>
          <FieldLabel htmlFor="property-search" className="sr-only">
            Search properties
          </FieldLabel>
          <Input
            id="property-search"
            type="search"
            placeholder="Search properties or values…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </Field>
        <p className="inspector-hint">
          Filter actions replace the current property filter. Copy preserves the JSON type.
        </p>
        {visible.length ? (
          <div className="inspector-properties">
            {visible.map(([key, value]) => (
              <div className="inspector-property" key={key} data-property={key}>
                <div className="inspector-property-heading">
                  <code>{key}</code>
                  <Badge variant="outline">{typeof value}</Badge>
                  <div className="inspector-property-actions">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Copy ${key}`}
                      title="Copy JSON value"
                      onClick={() => void copy(JSON.stringify(value))}
                    >
                      <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Filter by ${key}`}
                      title="Filter by this value"
                      onClick={() => onFilter(key, value)}
                    >
                      <HugeiconsIcon
                        icon={FilterHorizontalIcon}
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                    </Button>
                  </div>
                </div>
                <pre>{JSON.stringify(value)}</pre>
              </div>
            ))}
          </div>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>
                {properties.length ? "No matching properties" : "No properties captured"}
              </EmptyTitle>
              <EmptyDescription>
                {properties.length
                  ? "Try another property name or value."
                  : "This event was sent without custom properties."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </TabsContent>
      <TabsContent value="metadata" className="inspector-panel">
        <dl className="inspector-metadata">
          {[
            ["Event ID", event.event_id],
            ["Event name", event.name],
            ["Source", event.source],
            ["Event time (UTC)", new Date(event.timestamp).toISOString()],
            ["Received at (UTC)", new Date(event.received_at).toISOString()],
            ["Identity kind", event.identity_kind ?? "Not provided"],
            ["Actor ID", event.actor_id ?? "Not provided"],
            ["Session ID", event.session_id ?? "Not provided"],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                <code>{value}</code>
              </dd>
            </div>
          ))}
        </dl>
      </TabsContent>
      <TabsContent value="json" className="inspector-panel">
        <div className="inspector-json-heading">
          <span>Original event envelope</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void copy(JSON.stringify(event, null, 2))}
          >
            <HugeiconsIcon
              icon={Copy01Icon}
              strokeWidth={2}
              aria-hidden="true"
              data-icon="inline-start"
            />
            Copy JSON
          </Button>
        </div>
        <pre className="inspector-json">{JSON.stringify(event, null, 2)}</pre>
      </TabsContent>
    </Tabs>
  );
}
