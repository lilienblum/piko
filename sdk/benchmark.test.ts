import { expect, test } from "bun:test";

test("benchmark refuses an occupied port without sending requests to its owner", async () => {
  let requests = 0;
  const existing = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      requests++;
      return new URL(request.url).pathname === "/health"
        ? new Response("ok")
        : new Response("Not a benchmark API", { status: 500 });
    },
  });
  try {
    const child = Bun.spawn(["bun", "scripts/benchmark.ts"], {
      env: { ...process.env, BENCH_PORT: String(existing.port), BENCH_SECONDS: "1" },
      stdout: "ignore",
      stderr: "pipe",
    });
    const [code, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
    expect(code).not.toBe(0);
    expect(stderr).toMatch(/in use|EADDRINUSE/);
    expect(requests).toBe(0);
  } finally {
    await existing.stop(true);
  }
});
