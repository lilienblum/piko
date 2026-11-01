# Collecting events

A project can combine multiple collectors: for example, Website, iOS app, and CLI. Each source gets separate write-only keys; the key sets both project and source on the server. Do not send `product_id` or `source_id` in the event envelope. The existing `source` string describes the client/transport and does not change attribution. UUID event IDs must be unique across all sources in a project.

Identity remains optional and scoped to the project and identity kind. No person is automatically linked across web/mobile/tool sources. If you explicitly send the same opaque actor ID and identity kind from two sources, combined distinct-actor queries count it once. Use source-specific random IDs if that linkage is not intended. Visitor and installation identities remain distinct.

## TypeScript client

Copy `sdk/typescript/client.ts` into a website, Bun tool, or server. It has no dependencies. Create a project and choose or add a source in Settings, then create an ingestion key for that source. Use only source-scoped ingestion keys in collectors; management access remains separate. For websites, use the browser tracker below to apply privacy signals and opt-out behavior. The generic client sends explicit calls and does not manage collection preferences.

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

`sendBatch` accepts 1–100 events. IDs and timestamps are materialized once before retrying, preserving deduplication. The total request deadline includes retries and backoff. Redirects are refused, cookies and Referer are omitted, and an optional `signal` cancels delivery. 400/401/413/422 are not retried; retryable network/server failures and 429 get at most one retry by default. A Retry-After longer than the remaining deadline ends delivery immediately. Awaited sends return durable acknowledgment or throw a delivery error; catch errors if analytics must not fail your business operation.

## Browser tracker

```html
<script type="module" referrerpolicy="no-referrer">
  import { startBrowserTracker } from "https://piko.example.com/tracker.js";
  const tracker = startBrowserTracker({
    endpoint: "https://piko.example.com",
    key: "pk_...",
    identity: "none",
  });
  tracker.track("signup", { plan: "pro", seats: 3, trial: true });
</script>
```

Start the tracker only when your application's collection preference permits it. `enabled: false` returns an inert tracker: no automatic events, history hooks, timers, or identity storage. Piko treats Do Not Track (`navigator.doNotTrack === "1"`) and Global Privacy Control (`navigator.globalPrivacyControl === true`) as do-not-collect signals. They cannot be overridden. An absent signal is not a user's consent decision.

The hosted ESM module supports cross-origin import. The script's `referrerpolicy="no-referrer"` prevents the module request and its imports from carrying the embedding page's URL. For bundled or dynamically loaded integrations, configure the host page's Referrer-Policy too. The ingestion client independently omits Referer and cookies and refuses redirects.

The tracker sends `page_view` initially and after changed `pushState`, `replaceState`, or `popstate` navigation. Automatic properties contain the pathname and referrer hostname (or `Direct`). It excludes page titles, query strings, fragments, and full referrer URLs. Campaign capture is **off by default**. To collect reviewed campaign labels, opt in with an explicit list such as `campaigns: ["utm_source", "utm_medium", "utm_campaign"]`. The five supported names are `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, and `utm_content`; only listed parameters are copied.

Paths, hostnames, campaign labels, and custom properties can still contain personal data. Prefer static route patterns and bounded product categories. Configure these controls before starting collection:

```ts
const tracker = startBrowserTracker({
  endpoint: "https://piko.example.com",
  key: "pk_...",
  collectReferrer: false,
  sanitizePath: (path) => (path.startsWith("/users/") ? "/users/:id" : null),
  beforeSend(event) {
    if (event.name === "page_view") return event;
    if (event.name !== "signup") return null;
    return { ...event, properties: { trial: event.properties?.trial === true } };
  },
});
```

`sanitizePath` receives only the pathname; returning `null` omits the path. `collectReferrer: false` omits the referrer. `beforeSend` runs synchronously for automatic and custom events before they enter the queue. Return a sanitized event or `null` to drop it. A thrown sanitizer error drops the event. Accepted scalar properties are copied so later mutation does not change queued data. These are explicit collection policies, not automatic personal-data detection.

Identity defaults to **`none`**, with no visitor/session IDs or identifier storage. To measure visitors and sessions, explicitly set `identity: "persistent"` and `identityScope: "YOUR_PRODUCT_ID"` after your application's privacy decision. This creates a random, **pseudonymous** visitor ID in localStorage, scoped by collector origin and scope (the ingestion key if omitted). Using the product ID preserves this identifier through key rotation. A random session ID rolls after 30 minutes of inactivity. Tabs share storage best-effort and may race session creation. Storage denial falls back to unidentified events, with no fingerprint fallback. Do not use emails or account names as IDs.

On withdrawal, call `tracker.optOut()`. It stops collection, removes hooks/timers, discards queued events, aborts delivery, and removes only this tracker's stored visitor/session IDs. It cannot undo a request already received by the server. The host application must persist the user's choice and avoid starting another enabled tracker on reload. A later explicit opt-in requires a new tracker instance. Privacy signals are also checked before collecting and flushing, so a newly observed opt-out discards pending events.

The pending queue holds 100 events, sends batches of up to 20 (targeting 60 KiB of JSON), and flushes every two seconds. Full queues drop new events. Delivery uses keepalive fetch for bodies up to 64 KiB and ordinary fetch for larger bodies, with a short total deadline. Ordinary fetch cannot outlive page unload, and browser shutdown may lose events. `flush()` attempts one bounded batch. `shutdown()` stops collection and drains queued batches within one total `timeoutMs` deadline (800 ms by default), discarding anything still pending at the deadline. Neither guarantees delivery. `shutdown()` is a normal lifecycle flush; use **`optOut()`** for privacy withdrawal. Install only one tracker instance per page.

## Rust CLI

The implementation is in `apps/api/src/telemetry.rs`; the runnable example is `apps/api/examples/cli.rs`.

```sh
PIKO_TELEMETRY=1 \
PIKO_ENDPOINT=http://127.0.0.1:3000 \
PIKO_INGESTION_KEY=pk_YOUR_KEY \
cargo run -p piko --example cli -- build
```

The example sends only when `PIKO_TELEMETRY=1`, an endpoint, and a key are configured. `DO_NOT_TRACK=1` disables collection even when enabled. Try `-- fail` to report failure and exit nonzero. Events carry `command`, app `version`, `os`, `arch`, boolean `success`, and numeric `duration_ms`. Command labels are restricted to `build`, `fail`, `check`, `init`, `dev`, and `deploy`; other arguments are reported as `other`. The example does not create an installation ID automatically. Set `PIKO_INSTALLATION_ID` only to an optional random ID chosen under your application’s telemetry preference. To measure installations, generate one random ID once and store it in your application's configuration directory only with the user's chosen telemetry setting. Do not send usernames, machine names, arguments, filesystem paths, or command output by default.

`track` is nonblocking and returns false if its 32-slot channel is full. A worker sends batches of up to 50, refusing redirects and using one retry with the original IDs, honoring Retry-After (skipping the retry if its delay exceeds the request timeout), and a configurable request timeout (800 ms by default in the example). `flush(deadline)` waits for previous attempts; it does not claim server delivery. `shutdown(deadline)` includes queueing and network work and aborts the worker when the total deadline expires. The example permits at most the configured timeout +100 ms for shutdown, capped at 5100 ms. Dropping the client also aborts its task. Analytics failure never changes the CLI result or indefinitely delays exit.

To exercise the actual Rust example and verify its stored types locally, run `bun scripts/verify-cli.ts` while the API is running. It creates a small **Rust CLI example** product visible in the dashboard.

## Mobile / HTTP collectors

Create a mobile source and use its key with `POST /api/ingest`, from a native app's HTTP client or any other SDK. No device identifier or advertising ID is needed. For example:

```json
{
  "event_id": "GENERATE_ONE_UUID_PER_EVENT",
  "name": "screen_view",
  "source": "ios",
  "properties": { "screen": "home", "version": "2.1.0", "subscribed": false }
}
```

Supply `Authorization: Bearer pk_...` and `Content-Type: application/json`. Replace the example event ID with a real UUID. Set an explicit HTTP deadline, retain the exact envelope for bounded retries, and only send after your app's collection preference permits it. For retries, include the original UTC RFC3339 `timestamp` too. The server's 200 response acknowledges persistence. These are HTTP integration examples, not native Swift/Kotlin SDKs; see [retry and validation semantics](api.md#ingestion).
