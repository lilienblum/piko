import { tako } from "tako.sh";
import { readBoundedBody } from "./request-body";

// Bound buffered uploads before they reach the API's own admission limit.
const maxPendingIngestions = 64;
let pendingIngestions = 0;

export async function proxyApi(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const isIngest = url.pathname === "/api/ingest";
  const isUpload = isIngest && request.method === "POST";
  const unavailable = (message: string) =>
    Response.json(
      { error: message },
      {
        status: 503,
        headers: {
          "Retry-After": "1",
          ...(isIngest
            ? {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Expose-Headers": "Retry-After",
              }
            : {}),
        },
      },
    );
  if (isUpload && pendingIngestions >= maxPendingIngestions)
    return unavailable("Too many pending ingestion requests; retry shortly");
  const upstream = new URL(
    url.pathname + url.search,
    process.env.PIKO_API_URL ?? "http://127.0.0.1:3001",
  );
  const headers = new Headers();
  for (const name of [
    "accept",
    "content-type",
    "x-piko-admin",
    "origin",
    "access-control-request-method",
    "access-control-request-headers",
  ]) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  if (isIngest) {
    const key = request.headers.get("authorization");
    if (key !== null) headers.set("authorization", key);
  }
  // Dashboard-to-API service credentials remain server-side. Ingestion keeps its own bearer key.
  const credentials = tako.secrets as typeof tako.secrets & {
    readonly PIKO_API_ACCESS_CLIENT_ID?: string;
    readonly PIKO_API_ACCESS_CLIENT_SECRET?: string;
  };
  const accessId = credentials.PIKO_API_ACCESS_CLIENT_ID;
  const accessSecret = credentials.PIKO_API_ACCESS_CLIENT_SECRET;
  if (accessId && accessSecret) {
    headers.set("CF-Access-Client-Id", accessId);
    headers.set("CF-Access-Client-Secret", accessSecret);
  }
  if (isUpload) pendingIngestions++;
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(13_000)]);
  try {
    const body = ["GET", "HEAD"].includes(request.method)
      ? undefined
      : await readBoundedBody(request, 262_144, signal);
    return await fetch(upstream, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
      signal,
    });
  } catch (error) {
    if (error instanceof Response) {
      if (isIngest) error.headers.set("Access-Control-Allow-Origin", "*");
      return error;
    }
    return unavailable("API is unavailable; retry shortly");
  } finally {
    if (isUpload) pendingIngestions--;
  }
}
