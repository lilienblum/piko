import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Skeleton as MeasuredSkeleton } from "skullet/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function BreakdownLoading({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading breakdown" aria-busy="true">
      <span className="sr-only">Loading breakdown…</span>
      <MeasuredSkeleton loading>
        <div className="breakdown-head">
          <span>Event</span>
          <span>Events · Share</span>
        </div>
        {["a", "b", "c", "d", "e"].slice(0, rows).map((row) => (
          <div className="breakdown-row" key={row}>
            <span className="breakdown-label">Project activity</span>
            <span className="breakdown-value">1,234</span>
          </div>
        ))}
      </MeasuredSkeleton>
    </div>
  );
}
function ChartLoading({ title }: { title: string }) {
  return (
    <Card className="chart-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          <Skeleton className="h-[1.6em] w-48 max-w-full" />
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="series-chart chart-placeholder" aria-hidden="true">
          <Skeleton className="h-full w-full" />
        </div>
      </CardContent>
    </Card>
  );
}
function BreakdownCardLoading({ title, rows }: { title: string; rows?: number }) {
  return (
    <Card aria-hidden="true">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          <Skeleton className="h-[1.6em] w-40 max-w-full" />
        </CardDescription>
      </CardHeader>
      <CardContent>
        <BreakdownLoading rows={rows} />
      </CardContent>
    </Card>
  );
}
export function OverviewLoading({ labels, chart }: { labels: string[]; chart: ReactNode }) {
  return (
    <section role="status" aria-label="Loading overview" aria-busy="true">
      <span className="sr-only">Loading analytics…</span>
      <div className="metrics" data-columns={labels.length}>
        {labels.map((label) => (
          <Card className="metric-card" key={label}>
            <CardContent>
              <div className="metric-label">{label}</div>
              <div className="metric-value flex h-[1.4em] items-center">
                <MeasuredSkeleton loading>
                  <span>12,345</span>
                </MeasuredSkeleton>
              </div>
              <div className="metric-placeholder-detail" aria-hidden="true">
                <Skeleton className="h-[1.5em] w-32 max-w-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {chart}
      <div className="breakdowns overview-breakdowns">
        <BreakdownCardLoading title="Top events" />
        <BreakdownCardLoading title="Breakdown" />
      </div>
    </section>
  );
}
export function ExploreLoading() {
  return (
    <section role="status" aria-label="Loading query results" aria-busy="true">
      <span className="sr-only">Loading query results…</span>
      <div className="explore-summary" aria-hidden="true">
        <div className="explore-summary-value">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-3 w-44 max-w-full" />
        </div>
        <Skeleton className="h-8 w-40 shrink-0 max-sm:h-10" />
      </div>
      <div className="explore-charts">
        <ChartLoading title="Results over time" />
        <BreakdownCardLoading title="Breakdown" rows={3} />
      </div>
      <Card className="event-card event-stream">
        <CardHeader>
          <CardTitle>Event stream</CardTitle>
          <CardDescription>Newest first</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="stream-table" aria-hidden="true">
            <TableHeader>
              <TableRow>
                <TableHead className="stream-column-event">Event</TableHead>
                <TableHead className="stream-column-context">Context</TableHead>
                <TableHead className="stream-column-identity">Identity</TableHead>
                <TableHead className="stream-column-time">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3, 4, 5].map((n) => (
                <TableRow key={n}>
                  {["event", "context", "identity", "time"].map((column) => (
                    <TableCell key={column} className={`stream-column-${column}`}>
                      <div className="flex flex-col gap-2">
                        <Skeleton className="h-3 w-3/4" />
                        <Skeleton className="h-2.5 w-1/2" />
                      </div>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
export function PageLoading({ label = "Loading page" }: { label?: string }) {
  return (
    <div className="route-loading" role="status" aria-label={label} aria-busy="true">
      <span className="sr-only">{label}…</span>
      <MeasuredSkeleton loading>
        <p>Loading your project analytics</p>
      </MeasuredSkeleton>
    </div>
  );
}
