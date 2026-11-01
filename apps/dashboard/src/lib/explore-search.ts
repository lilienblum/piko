export type ExploreDrilldown = {
  productId: string;
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
};
const validKey = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_./-]{1,64}$/.test(value);
const validDate = (value: unknown): value is string =>
  typeof value === "string" &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;

export function validateExploreSearch(search: Record<string, unknown>): ExploreSearch {
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
    typeof d.productId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(d.productId) ||
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
      productId: d.productId,
      from: d.from,
      to: d.to,
      ...(d.event !== undefined ? { event: d.event as string } : {}),
      ...(d.source !== undefined ? { source: d.source as string } : {}),
      ...(d.sourceId !== undefined ? { sourceId: d.sourceId as string } : {}),
      ...(filter ? { filter } : {}),
    },
  };
}
