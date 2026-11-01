# Mixed ingestion/query benchmark

Measured on **1 November 2026** with the final **one-DuckDB-file-per-product** layout. Raw results, timestamp, and runtime settings are in [benchmark-results.json](benchmark-results.json). These are local observations, not estimates or a production capacity guarantee.

## Reproduce

```sh
bun install --frozen-lockfile
cargo build --locked --release -p piko
bun benchmark
# Optional larger/longer run:
BENCH_SECONDS=60 BENCH_PRELOAD=100000 BENCH_OUTPUT=docs/my-benchmark.json bun benchmark
```

The script starts a release API on loopback port 3199 (`BENCH_PORT` overrides it), creates a temporary data directory and two products, and cleans up that temporary directory afterward. No running workspace is mutated. It requires a host with `ps` for RSS sampling. Run it after builds and other load tests finish for comparable results.

## Hardware and workload

- Apple M1 Pro, 10 logical CPUs, 16 GiB RAM; darwin 25.6.0, arm64.
- Rust 1.99.1, Bun 1.4.4, DuckDB Rust crate 1.20000.1; optimized release build, local filesystem, no TLS/proxy.
- Two products, separate database files. 10,000 preloaded events distributed over 30 days. String, boolean, and numeric properties; 1,000 potential actor IDs per product.
- Four concurrent ingestion workers, 100 events per batch; every tenth batch is retried with identical IDs. Two concurrent query workers alternate website counts and filtered tool averages.
- Each query computes the summary, daily buckets, top groups, matching count, event-name list, and 25-event page. This measures a complete dashboard request, not a single trivial SQL count.
- Global query concurrency 4; ingestion capacity 64 requests; eight cached product instances maximum. Each DuckDB instance uses two execution threads and a 64 MB buffer limit.
- Closed-loop load for 15 seconds; reported elapsed time (15.062 seconds) includes completion of in-flight requests. Successful request latencies are measured at the HTTP client. Dedup retry requests contribute to elapsed time and load, but are not included in the first-attempt ingestion latency samples.

## Measured results

| Metric                                          |                Observed |
| ----------------------------------------------- | ----------------------: |
| Newly committed events                          |                 233,000 |
| Duplicate events acknowledged without insertion |                  23,200 |
| Verified final stored events (preload + new)    |                 243,000 |
| Committed event throughput                      |              15,469/sec |
| Successful analytical requests                  |                     687 |
| Analytical request throughput                   |                45.6/sec |
| Ingestion request p50 / p95 / p99               |   23.1 / 28.3 / 32.5 ms |
| Query request p50 / p95 / p99                   | 37.4 / 105.9 / 137.2 ms |
| API RSS after preload                           |                60.2 MiB |
| Peak sampled API RSS                            |               235.6 MiB |
| Request failures                                |                       0 |

The script queries both products after measurement and fails unless the final row count equals preload plus acknowledged new events. The 23,200 retried IDs did not inflate stored counts.

## Interpretation and limits

This is a short, single-host run with an initially warm 10,000-event dataset that grows to 243,000 events. It does not establish long-term throughput, durability under abrupt power loss, multi-million-row latency, sustained overload fairness, or performance on a small VPS. Network/TLS/Cloudflare latency and Bun dashboard memory are excluded. RSS is sampled every 250 ms and may miss short peaks. DuckDB's buffer limits do not cap all process allocations; total RSS can exceed the sum of active database buffer limits.

Controlled overload is tested separately by holding query permits and saturating ingestion admission, verifying 503 responses and successful recovery. Retention, migration, and restart persistence have correctness tests; their performance is not included in these figures. The eight-instance cache bounds resources with many products, but this benchmark exercises two products and does not measure cache-thrashing latency.
