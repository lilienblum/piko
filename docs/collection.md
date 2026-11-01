# Collecting events

## TypeScript client

Copy `sdk/typescript/client.ts` into a website, Bun tool, or server. It has no dependencies. Create a product and ingestion key in Settings. Never use the admin token in a collector.

```ts
import { Piko } from "./sdk/typescript/client";
const piko = new Piko({
  endpoint: "https://piko.example.com",
  key: "pk_...",
  timeoutMs: 800,
  retries: 1,
});
await piko.send({
  name: "purchase",
  source: "server",
  properties: { amount: 29.5, paid: true, currency: "USD" },
});
```

`sendBatch` accepts 1–100 events. IDs and timestamps are materialized once before retrying, preserving deduplication. The total request deadline includes retries and backoff. 400/401/413/422 are not retried; retryable network/server failures and 429 get at most one retry by default. A Retry-After longer than the remaining deadline ends delivery immediately. Awaited sends return durable acknowledgment or throw a delivery error; catch errors if analytics must not fail your business operation.

## Browser tracker

```html
<script type="module">
  import { startBrowserTracker } from "https://piko.example.com/tracker.js";
  const tracker = startBrowserTracker({
    endpoint: "https://piko.example.com",
    key: "pk_...",
    identity: "persistent", // opt in only after your application's consent decision
    identityScope: "YOUR_PRODUCT_ID",
    sanitizePath: path => path.replace(/\/users\/[^/]+/, "/users/:id"),
  });
  tracker.track("signup", { plan: "pro", seats: 3, trial: true });
  // For an app lifecycle boundary:
  // await tracker.shutdown();
</script>
```

The hosted ESM module includes the client and allows cross-origin import. It sends `page_view` initially and on changed `pushState`, `replaceState`, or `popstate` navigation. It collects pathname, referrer hostname (or Direct), and the five standard `utm_*` parameters. Full URLs, fragments, arbitrary query strings, titles, IPs, and user agents are not stored by Piko. Paths and campaign values may still contain personal data: use `sanitizePath` and decide what your custom properties contain.

Identity defaults to **`none`**. With `persistent`, the tracker creates a random visitor ID in localStorage, scoped by collector origin and `identityScope` (defaults to the public ingestion key). Using a product ID as the scope preserves identity through key rotation. It stores a random session ID in the same scope, rolling it after 30 minutes of inactivity. Tabs share localStorage best-effort; simultaneous tabs may race session creation. No cross-device or cross-product stitching occurs on the server. Storage denial falls back to anonymous collection; no fingerprint is derived. Do Not Track disables collection by default (`respectDoNotTrack: false` explicitly overrides it).

There is a 100-event pending queue, a 20-event send batch, and a 2-second flush interval. Full queues drop new events immediately. Page-hide delivery uses keepalive fetch; browser shutdown may still lose events. `flush`/`shutdown` attempt one bounded batch and do not guarantee all pending events are delivered; the normal periodic worker drains remaining batches. Do not install multiple tracker instances on the same page. These examples are intentionally small, not a full consent or attribution platform.

## Rust CLI

The implementation is in `apps/api/src/telemetry.rs`; the runnable example is `apps/api/examples/cli.rs`.

```sh
PIKO_ENDPOINT=http://127.0.0.1:3000 \
PIKO_INGESTION_KEY=pk_YOUR_KEY \
PIKO_INSTALLATION_ID=your-optional-random-install-id \
cargo run -p piko --example cli -- build
```

Try `-- fail` to report failure and exit nonzero. Events carry `command`, app `version`, `os`, `arch`, boolean `success`, and numeric `duration_ms`. The example does not create an installation ID automatically. To measure installations, generate one random ID once and store it in your application's configuration directory only with the user's chosen telemetry setting. Do not send usernames, machine names, arguments, filesystem paths, or command output by default.

`track` is nonblocking and returns false if its 32-slot channel is full. A worker sends batches of up to 50, with one retry using the original IDs, and a configurable request timeout (800 ms by default in the example). `flush(deadline)` waits for previous attempts; it does not claim server delivery. `shutdown(deadline)` includes queueing and network work and aborts the worker when the total deadline expires. The example permits at most the configured timeout +100 ms for shutdown, capped at 5100 ms. Dropping the client also aborts its task. Analytics failure never changes the CLI result or indefinitely delays exit.
