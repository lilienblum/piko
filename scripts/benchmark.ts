import { mkdtemp, rm } from "node:fs/promises";
import { cpus, totalmem, platform, release, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Piko, type Event } from "../sdk/typescript/client";
const duration = Number(process.env.BENCH_SECONDS ?? 15);
const preload = Number(process.env.BENCH_PRELOAD ?? 10000);
const port = Number(process.env.BENCH_PORT ?? 3199);
// Fail before spawning or writing fixtures if another service owns the requested port.
const reservation = Bun.serve({
  hostname: "127.0.0.1",
  port,
  fetch: () => new Response(null, { status: 503 }),
});
await reservation.stop(true);
const dir = await mkdtemp(join(tmpdir(), "piko-bench-"));
const endpoint = `http://127.0.0.1:${port}`;
const log = Bun.file(join(dir, "server.log"));
const processHandle = Bun.spawn([resolve("target/release/piko")], {
  env: {
    ...process.env,
    PIKO_DATA_DIR: dir,
    PIKO_BIND: `127.0.0.1:${port}`,
    PIKO_QUERY_CONCURRENCY: "4",
    PIKO_QUEUE_CAPACITY: "64",
  },
  stdout: log,
  stderr: log,
});
let peakRss = 0;
let baselineRss = 0;
const rss = () => {
  const output = Bun.spawnSync([
    "ps",
    "-o",
    "rss=",
    "-p",
    String(processHandle.pid),
  ]).stdout.toString();
  return Number(output.trim()) * 1024;
};
const times = { ingest: [] as number[], query: [] as number[] };
const errors: Record<string, number> = {};
let accepted = 0;
let duplicates = 0;
let queries = 0;
const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? null;
};
async function request(path: string, body?: unknown) {
  const r = await fetch(`${endpoint}/api${path}`, {
    method: body ? "POST" : "GET",
    headers: { "x-piko-admin": "1", "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  return r.json();
}
function batch(product: number, sequence: number, size = 100): Event[] {
  return Array.from({ length: size }, (_, i) => ({
    event_id: `bench-${product}-${sequence}-${i}`,
    name: product === 0 ? "page_view" : "command_run",
    source: product === 0 ? "browser" : "cli",
    timestamp: new Date(Date.now() - ((sequence * 100 + i) % 30) * 86400000).toISOString(),
    actor_id: `actor-${(sequence * 100 + i) % 1000}`,
    identity_kind: product === 0 ? "visitor" : "installation",
    properties: {
      duration_ms: (sequence * 100 + i) % 1000,
      success: i % 17 !== 0,
      path: ["/", "/docs", "/pricing"][i % 3],
      command: ["build", "deploy", "dev"][i % 3],
      version: "1.4.2",
      os: i % 2 ? "linux" : "macos",
    },
  }));
}
let sampler: ReturnType<typeof setInterval> | undefined;
try {
  let ready = false;
  const startupDeadline = Date.now() + 10_000;
  while (Date.now() < startupDeadline) {
    if (processHandle.exitCode !== null)
      throw new Error(`API exited during startup: ${await log.text()}`);
    try {
      if ((await fetch(`${endpoint}/health`, { signal: AbortSignal.timeout(500) })).ok) {
        ready = true;
        break;
      }
    } catch {}
    await Bun.sleep(50);
  }
  if (!ready) throw new Error(`API startup failed: ${await log.text()}`);
  const products: { id: string; client: Piko }[] = [];
  for (const kind of ["website", "tool"]) {
    const p = await request("/products", { name: `Benchmark ${kind}`, retention_days: 90 });
    const k = await request(`/products/${p.id}/keys`, { label: "benchmark" });
    products.push({
      id: p.id,
      client: new Piko({ endpoint, key: k.key, timeoutMs: 15000, retries: 0 }),
    });
  }
  for (let i = 0; i < Math.ceil(preload / 100); i++) {
    await products[i % 2].client.sendBatch(batch(i % 2, i, Math.min(100, preload - i * 100)));
  }
  baselineRss = rss();
  peakRss = baselineRss;
  sampler = setInterval(() => {
    peakRss = Math.max(peakRss, rss());
  }, 250);
  const started = performance.now();
  const deadline = started + duration * 1000;
  const ingestWorkers = Array.from({ length: 4 }, (_, worker) =>
    (async () => {
      let seq = 100000 + worker * 100000;
      while (performance.now() < deadline) {
        const product = worker % 2;
        const events = batch(product, seq++);
        const begin = performance.now();
        try {
          const a = await products[product].client.sendBatch(events);
          accepted += a.accepted;
          duplicates += a.duplicates;
          times.ingest.push(performance.now() - begin);
          if (seq % 10 === 0) {
            const duplicate = await products[product].client.sendBatch(events);
            duplicates += duplicate.duplicates;
          }
        } catch (e) {
          const error = (e as Error).message;
          errors[error] = (errors[error] ?? 0) + 1;
        }
      }
    })(),
  );
  const queryWorkers = Array.from({ length: 2 }, (_, worker) =>
    (async () => {
      while (performance.now() < deadline) {
        const begin = performance.now();
        try {
          await request(`/products/${products[worker].id}/query`, {
            from: new Date(Date.now() - 31 * 86400000).toISOString(),
            to: new Date(Date.now() + 1000).toISOString(),
            measure: worker ? "avg" : "count",
            property: "duration_ms",
            group_by: worker ? "property:command" : "property:path",
            filters: worker ? [{ property: "success", op: "eq", value: true }] : [],
            page_size: 25,
          });
          queries++;
          times.query.push(performance.now() - begin);
        } catch (e) {
          const error = (e as Error).message;
          errors[error] = (errors[error] ?? 0) + 1;
        }
      }
    })(),
  );
  await Promise.all([...ingestWorkers, ...queryWorkers]);
  const elapsed = (performance.now() - started) / 1000;
  let stored = 0;
  for (const product of products) {
    const result = await request(`/products/${product.id}/query`, {
      from: new Date(Date.now() - 31 * 86400000).toISOString(),
      to: new Date(Date.now() + 1000).toISOString(),
    });
    stored += result.summary.total;
  }
  if (stored !== preload + accepted)
    throw new Error(`Persisted count mismatch: ${stored} vs ${preload + accepted}`);
  const report = {
    measured_at: new Date().toISOString(),
    hardware: {
      cpu: cpus()[0]?.model,
      logical_cpus: cpus().length,
      memory_bytes: totalmem(),
      os: `${platform()} ${release()}`,
      architecture: process.arch,
    },
    runtime: {
      bun: Bun.version,
      rust: Bun.spawnSync(["rustc", "--version"]).stdout.toString().trim(),
      profile: "release",
      duckdb: "2.0.0 (duckdb-rs 1.20000.1)",
      query_connections: 4,
      queue_batches: 64,
      duckdb_threads: 2,
      duckdb_memory_limit_per_product: "64MB",
      max_open_product_databases: 8,
      layout: "one DuckDB file per product",
    },
    workload: {
      preload_events: preload,
      products: 2,
      batch_size: 100,
      ingest_workers: 4,
      query_workers: 2,
      requested_seconds: duration,
      actual_seconds: elapsed,
      dedup_retry_every_batches: 10,
      notes:
        "Closed-loop localhost HTTP. 30-day dataset; query computes summary, daily buckets, top groups, count, and 25 events. Timer includes final request drain. RSS sampled every 250 ms; API process only.",
    },
    results: {
      accepted_events: accepted,
      verified_stored_events: stored,
      duplicate_events: duplicates,
      events_per_second: accepted / elapsed,
      successful_queries: queries,
      queries_per_second: queries / elapsed,
      ingestion_ms: {
        p50: percentile(times.ingest, 0.5),
        p95: percentile(times.ingest, 0.95),
        p99: percentile(times.ingest, 0.99),
      },
      query_ms: {
        p50: percentile(times.query, 0.5),
        p95: percentile(times.query, 0.95),
        p99: percentile(times.query, 0.99),
      },
      baseline_rss_bytes: baselineRss,
      peak_rss_bytes: peakRss,
      errors,
    },
  };
  const output = process.env.BENCH_OUTPUT ?? "docs/benchmark-results.json";
  await Bun.write(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (sampler) clearInterval(sampler);
  processHandle.kill("SIGTERM");
  await processHandle.exited;
  await rm(dir, { recursive: true, force: true });
}
