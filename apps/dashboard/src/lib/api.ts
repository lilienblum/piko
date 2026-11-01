export type SourceKind = "website" | "mobile" | "tool" | "generic";
export type Source = {
  id: string;
  product_id: string;
  name: string;
  kind: SourceKind;
  created_at: string;
};
export const sourceKinds = [
  ["website", "Website"],
  ["mobile", "Mobile app"],
  ["tool", "Developer tool"],
  ["generic", "Other"],
] as const;
export type Product = {
  id: string;
  name: string;
  kind: SourceKind;
  sources: Source[];
  retention_days: number;
  created_at: string;
};
export type Properties = Record<string, string | number | boolean>;
export type EventRow = {
  event_id: string;
  name: string;
  source: string;
  source_id: string;
  timestamp: number;
  received_at: number;
  actor_id: string | null;
  identity_kind: string | null;
  session_id: string | null;
  properties: Properties;
};
export type Group = {
  display?: string;
  label: string | number | boolean | null;
  value: number | null;
  count: number;
};
export type QueryResult = {
  summary: {
    total: number;
    actors: number;
    visitors: number;
    installations: number;
    sessions: number;
    session_views: number;
    success_rate: number | null;
    avg_duration: number | null;
    p95_duration: number | null;
    value: number | null;
  };
  series: { time: number; value: number | null }[];
  groups: Group[];
  events: EventRow[];
  event_names: string[];
  page: number;
  page_size: number;
};
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    signal,
    headers: { "content-type": "application/json", "x-piko-admin": "1" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new ApiError(payload.error ?? `Request failed (${response.status})`, response.status);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export const number = (n: number | null | undefined, digits = 0) =>
  n == null ? "—" : new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(n);
export function groupLabel(value: Group["label"]) {
  return value === null ? "Not provided" : value === "" ? "Empty string" : String(value);
}

export function sourceGroups(groups: Group[], sources: Source[] = []): Group[] {
  return groups.map((group) => ({
    ...group,
    display: sources.find((source) => source.id === group.label)?.name ?? "Unknown source",
  }));
}
