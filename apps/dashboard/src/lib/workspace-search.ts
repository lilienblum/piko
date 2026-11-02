import { DAY_MS, MAX_RANGE_DAYS, periodLabels, type DatePeriod } from "./date-range";
export type WorkspaceSearch = {
  /** Legacy entry input only; canonical URLs use /projects/$projectSlug. */
  project?: string;
  source?: string;
  days?: 7 | 30 | 90;
  period?: DatePeriod;
  snapshot?: string;
  from?: string;
  to?: string;
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
    (search.period !== undefined &&
      (typeof search.period !== "string" ||
        !Object.hasOwn(periodLabels, search.period) ||
        search.from !== undefined ||
        search.snapshot !== undefined)) ||
    (search.project !== undefined &&
      (typeof search.project !== "string" ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(search.project) ||
        search.project.length > 80)) ||
    (search.source !== undefined && search.source !== "all" && !validId(search.source)) ||
    (search.days !== undefined &&
      ![7, 30, 90, "7", "30", "90"].includes(search.days as number | string)) ||
    (search.snapshot !== undefined && !validDate(search.snapshot)) ||
    ((search.from !== undefined || search.to !== undefined) &&
      (!validDate(search.from) ||
        !validDate(search.to) ||
        search.snapshot !== undefined ||
        Date.parse(search.to) <= Date.parse(search.from) ||
        Date.parse(search.to) - Date.parse(search.from) > MAX_RANGE_DAYS * DAY_MS))
  )
    return {
      project: undefined,
      source: undefined,
      days: undefined,
      snapshot: undefined,
      from: undefined,
      to: undefined,
      invalidWorkspace: true,
    };
  return {
    project: search.project as string | undefined,
    source: search.source as string | undefined,
    period: search.period as DatePeriod | undefined,
    days: search.days === undefined ? undefined : (Number(search.days) as 7 | 30 | 90),
    snapshot: search.snapshot as string | undefined,
    from: search.from as string | undefined,
    to: search.to as string | undefined,
  };
}

export type OverviewFilter = { field: string; value: string | number | boolean };
export type OverviewSearch = {
  filter?: OverviewFilter;
  invalidFilter?: true;
  metric?: "count" | "actors" | "visitors" | "installations" | "average" | "p95";
  breakdown?: string;
  duration?: "avg" | "p95";
};
export function validateOverviewSearch(s: Record<string, unknown>): OverviewSearch {
  const filter = s.filter as Partial<OverviewFilter> | undefined;
  const valid =
    filter &&
    typeof filter === "object" &&
    typeof filter.field === "string" &&
    (["name", "source"].includes(filter.field) ||
      (filter.field.startsWith("property:") && validKey(filter.field.slice(9)))) &&
    ((typeof filter.value === "string" && filter.value.length <= 512) ||
      typeof filter.value === "boolean" ||
      (typeof filter.value === "number" && Number.isFinite(filter.value))) &&
    (!["name", "source"].includes(filter.field) || typeof filter.value === "string");
  return {
    ...(s.filter !== undefined
      ? valid
        ? { filter: filter as OverviewFilter }
        : { invalidFilter: true as const }
      : {}),
    metric: ["count", "actors", "visitors", "installations", "average", "p95"].includes(
      typeof s.metric === "string" ? s.metric : "",
    )
      ? (s.metric as OverviewSearch["metric"])
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
