// The dashboard owns this gateway. The Rust API has no frontend dependency.
const bundlePath = "./dist/server/server.js";
const { default: start } = (await import(bundlePath)) as {
  default: { fetch(request: Request): Promise<Response> };
};
const apiOrigin = process.env.PIKO_API_URL ?? "http://127.0.0.1:3001";
const publicRoot = new URL("./dist/client/", import.meta.url);
const server = Bun.serve({
  hostname: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? 3000),
  maxRequestBodySize: 256 * 1024,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        const headers = new Headers(request.headers);
        headers.delete("host");
        return await fetch(`${apiOrigin}${url.pathname}${url.search}`, {
          method: request.method,
          headers,
          body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
          signal: AbortSignal.timeout(13000),
          redirect: "manual",
        });
      } catch {
        return Response.json(
          { error: "The analytics API is unavailable. Try again shortly." },
          { status: 503, headers: { "retry-after": "1" } },
        );
      }
    }
    if (url.pathname === "/health") return Response.json({ status: "ok" });
    if (!["GET", "HEAD"].includes(request.method))
      return new Response("Method not allowed", { status: 405 });
    let fileUrl: URL;
    try {
      fileUrl = new URL(`.${decodeURIComponent(url.pathname)}`, publicRoot);
    } catch {
      return new Response("Invalid path", { status: 400 });
    }
    if (!fileUrl.pathname.startsWith(publicRoot.pathname))
      return new Response("Not found", { status: 404 });
    const file = Bun.file(fileUrl);
    if (await file.exists())
      return new Response(request.method === "HEAD" ? null : file, {
        headers: {
          "content-type": file.type,
          "access-control-allow-origin": "*",
          "x-content-type-options": "nosniff",
          "cache-control": url.pathname.startsWith("/assets/")
            ? "public, max-age=31536000, immutable"
            : "no-cache",
        },
      });
    const response = await start.fetch(request);
    response.headers.set("x-content-type-options", "nosniff");
    response.headers.set("x-frame-options", "DENY");
    response.headers.set("cache-control", "no-store");
    return response;
  },
});
console.log(`Piko dashboard: ${server.url}`);
export {};
