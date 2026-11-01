import { tako } from "tako.sh";
import { readBoundedBody } from "./request-body";

export async function proxyApi(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const upstream = new URL(
    url.pathname + url.search,
    process.env.PIKO_API_URL ?? "http://127.0.0.1:3001",
  );
  const headers = new Headers(request.headers);
  for (const name of ["host", "connection", "transfer-encoding", "upgrade", "content-length"])
    headers.delete(name);
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
  try {
    const body = ["GET", "HEAD"].includes(request.method)
      ? undefined
      : await readBoundedBody(request, 262_144);
    return await fetch(upstream, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(13_000)]),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: "API is unavailable; retry shortly" }, { status: 503 });
  }
}
