export type WorkspaceSearch = {
  /** Legacy entry input only; canonical URLs use /projects/$projectSlug. */
  project?: string;
  source?: string;
  days?: 7 | 30 | 90;
  snapshot?: string;
  invalidWorkspace?: true;
};
export const validDate = (value: unknown): value is string =>
  typeof value === "string" &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value &&
  Date.parse(value) >= 0 &&
  Date.parse(value) <= Date.UTC(9999, 11, 31);
export const validId = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const validKey = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_./-]{1,64}$/.test(value);

export function validateWorkspaceSearch(search: Record<string, unknown>): WorkspaceSearch {
  if (
    search.invalidWorkspace === true ||
    (search.project !== undefined &&
      (typeof search.project !== "string" ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(search.project) ||
        search.project.length > 80)) ||
    (search.source !== undefined && search.source !== "all" && !validId(search.source)) ||
    (search.days !== undefined &&
      ![7, 30, 90, "7", "30", "90"].includes(search.days as number | string)) ||
    (search.snapshot !== undefined && !validDate(search.snapshot))
  )
    return {
      project: undefined,
      source: undefined,
      days: undefined,
      snapshot: undefined,
      invalidWorkspace: true,
    };
  return {
    project: search.project as string | undefined,
    source: search.source as string | undefined,
    days: search.days === undefined ? undefined : (Number(search.days) as 7 | 30 | 90),
    snapshot: search.snapshot as string | undefined,
  };
}

export type OverviewSearch = {
  metric?: "count" | "actors" | "visitors" | "installations" | "average" | "p95";
  interval?: "hour" | "day" | "week" | "month";
  breakdown?: string;
  duration?: "avg" | "p95";
};
export function validateOverviewSearch(s: Record<string, unknown>): OverviewSearch {
  return {
    metric: ["count", "actors", "visitors", "installations", "average", "p95"].includes(
      typeof s.metric === "string" ? s.metric : "",
    )
      ? (s.metric as OverviewSearch["metric"])
      : undefined,
    interval: ["hour", "day", "week", "month"].includes(
      typeof s.interval === "string" ? s.interval : "",
    )
      ? (s.interval as OverviewSearch["interval"])
      : undefined,
    breakdown: [
      "name",
      "source_id",
      "source",
      "property:path",
      "property:command",
      "property:referrer",
      "property:utm_source",
      "property:utm_campaign",
      "property:screen",
      "property:version",
      "property:os",
      "property:arch",
    ].includes(typeof s.breakdown === "string" ? s.breakdown : "")
      ? String(s.breakdown)
      : undefined,
    duration: s.duration === "avg" || s.duration === "p95" ? s.duration : undefined,
  };
}
