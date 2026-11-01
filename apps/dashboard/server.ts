// The dashboard owns this gateway. The Rust API has no frontend dependency.
const bundlePath = "./dist/server/server.js";
const { default: start } = (await import(bundlePath)) as {
  default: { fetch(request: Request): Promise<Response> };
};
const publicRoot = new URL("./dist/client/", import.meta.url);
const server = Bun.serve({
  hostname: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? 3000),
  maxRequestBodySize: 256 * 1024,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return Response.json({ status: "ok" });
    let fileUrl: URL;
    try {
      fileUrl = new URL(`.${decodeURIComponent(url.pathname)}`, publicRoot);
    } catch {
      return new Response("Invalid path", { status: 400 });
    }
    if (!fileUrl.pathname.startsWith(publicRoot.pathname))
      return new Response("Not found", { status: 404 });
    const file = Bun.file(fileUrl);
    if (["GET", "HEAD"].includes(request.method) && (await file.exists()))
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
    const headers = new Headers(response.headers);
    headers.set("x-content-type-options", "nosniff");
    headers.set("x-frame-options", "DENY");
    if (!headers.has("cache-control")) headers.set("cache-control", "no-store");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
});
console.log(`Piko dashboard: ${server.url}`);
export {};
