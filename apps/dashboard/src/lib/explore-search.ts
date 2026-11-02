import { validKey, validDate } from "./workspace-search";
export type ExploreDrilldown = {
  productId?: string;
  from: string;
  to: string;
  event?: string;
  source?: string;
  sourceId?: string;
  filter?: { property: string; value: string | number | boolean };
};
export type ExploreSearch = {
  drilldown?: ExploreDrilldown;
  invalidDrilldown?: true;
  query?: ExploreSpec;
  page?: number;
  pageSize?: number;
  invalidQuery?: true;
};
function validateDrilldown(search: Record<string, unknown>): ExploreSearch {
  if (search.drilldown === undefined) {
    return {
      drilldown: undefined,
      invalidDrilldown: search.invalidDrilldown === true ? true : undefined,
    };
  }
  const value = search.drilldown;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { drilldown: undefined, invalidDrilldown: true };
  }
  const d = value as Record<string, unknown>;
  if (
    (d.productId !== undefined &&
      (typeof d.productId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(d.productId))) ||
    !validDate(d.from) ||
    !validDate(d.to) ||
    Date.parse(d.to) <= Date.parse(d.from) ||
    Date.parse(d.to) - Date.parse(d.from) > 366 * 86400000 ||
    (d.event !== undefined && !validKey(d.event)) ||
    (d.source !== undefined && !validKey(d.source)) ||
    (d.sourceId !== undefined &&
      (typeof d.sourceId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(d.sourceId)))
  )
    return { drilldown: undefined, invalidDrilldown: true };
  let filter: ExploreDrilldown["filter"];
  if (d.filter !== undefined) {
    if (!d.filter || typeof d.filter !== "object" || Array.isArray(d.filter)) {
      return { drilldown: undefined, invalidDrilldown: true };
    }
    const f = d.filter as Record<string, unknown>;
    if (
      !validKey(f.property) ||
      !(
        typeof f.value === "boolean" ||
        (typeof f.value === "number" && Number.isFinite(f.value)) ||
        (typeof f.value === "string" && new TextEncoder().encode(f.value).length <= 2048)
      )
    )
      return { drilldown: undefined, invalidDrilldown: true };
    filter = { property: f.property, value: f.value as string | number | boolean };
  }
  return {
    invalidDrilldown: undefined,
    drilldown: {
      productId: d.productId as string | undefined,
      from: d.from,
      to: d.to,
      ...(d.event !== undefined ? { event: d.event as string } : {}),
      ...(d.source !== undefined ? { source: d.source as string } : {}),
      ...(d.sourceId !== undefined ? { sourceId: d.sourceId as string } : {}),
      ...(filter ? { filter } : {}),
    },
  };
}

export type ExploreSpec = {
  event: string;
  source: string;
  measure: string;
  property: string;
  group: string;
  filterProperty: string;
  filterOp: string;
  filterValue: string;
};
export const defaultSpec: ExploreSpec = {
  event: "",
  source: "",
  measure: "count",
  property: "duration_ms",
  group: "name",
  filterProperty: "",
  filterOp: "eq",
  filterValue: "",
};
export function validateExploreSearch(search: Record<string, unknown>): ExploreSearch {
  const result = validateDrilldown(search);
  if (
    search.invalidQuery === true ||
    (search.page !== undefined &&
      (!Number.isInteger(search.page) || Number(search.page) < 1 || Number(search.page) > 10001)) ||
    (search.pageSize !== undefined && ![15, 30, 50].includes(Number(search.pageSize)))
  )
    return { ...result, invalidQuery: true };
  result.page = search.page as number | undefined;
  result.pageSize = search.pageSize === undefined ? undefined : Number(search.pageSize);
  if (search.query === undefined) return result;
  if (!search.query || typeof search.query !== "object" || Array.isArray(search.query))
    return { ...result, invalidQuery: true };
  const raw = search.query as Record<string, unknown>;
  const spec = { ...defaultSpec };
  for (const key of Object.keys(defaultSpec) as (keyof ExploreSpec)[]) {
    if (raw[key] !== undefined) {
      if (typeof raw[key] !== "string") return { ...result, invalidQuery: true };
      spec[key] = raw[key] as string;
    }
  }
  if (
    (spec.event && !validKey(spec.event)) ||
    (spec.source && !validKey(spec.source)) ||
    !["count", "actors", "sum", "avg", "p50", "p95"].includes(spec.measure) ||
    !validKey(spec.property) ||
    !(
      ["name", "source", "source_id", "identity_kind"].includes(spec.group) ||
      (spec.group.startsWith("property:") && validKey(spec.group.slice(9)))
    ) ||
    (spec.filterProperty && !validKey(spec.filterProperty)) ||
    !["eq", "ne", "gt", "gte", "lt", "lte"].includes(spec.filterOp) ||
    new TextEncoder().encode(spec.filterValue).length > 2048
  )
    return { ...result, invalidQuery: true };
  result.query = spec;
  return result;
}
