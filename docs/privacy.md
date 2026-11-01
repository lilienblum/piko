# Privacy model

Piko is built to minimize collection by default. It does not add IP addresses, user-agent strings, geolocation, device fingerprints, page titles, form values, command output, or account information to analytics events. It does not send analytics to a Piko-operated service. Data goes to the collector you configure and remains in your self-hosted storage.

## Defaults and explicit choices

| Surface               | Default                                      | Explicit choice                                       |
| --------------------- | -------------------------------------------- | ----------------------------------------------------- |
| Browser identity      | No visitor/session IDs or identifier storage | Persistent random IDs, scoped to the product          |
| Browser page metadata | Pathname and referrer hostname only          | Omit or canonicalize paths; disable referrers         |
| Campaigns             | No campaign parameters                       | Allowlist individual UTM names                        |
| Privacy signals       | DNT/GPC stop collection                      | No override; absence is not consent                   |
| Custom events         | Only caller-supplied scalar properties       | Filter or drop with `beforeSend`                      |
| CLI example           | Telemetry off; no installation ID            | `PIKO_TELEMETRY=1`; optional random installation ID   |
| CLI opt-out           | `DO_NOT_TRACK=1` takes precedence            | Host application owns its persistent preference       |
| Retention             | New Settings products start at 30 days       | Set a product-specific window between 1 and 3650 days |

Persistent random IDs are pseudonymous, not anonymous. Piko separates visitor/session identities from CLI installations, and all identities are scoped to a product in queries. Do not use emails, account names, machine names, or credentials as IDs or properties.

## Collection controls

Choose a collection policy before loading the tracker. `enabled: false` starts inert; `sanitizePath` can map private URLs to route patterns or omit the path; `collectReferrer: false` removes the referrer; and `beforeSend` can sanitize or drop any event. Exceptions from sanitizers drop the event. See [the collection guide](collection.md) for examples.

Use `optOut()` for withdrawal. It stops future collection, discards the pending queue, aborts delivery, and clears that tracker's stored identity. Persist the user's choice in your application and honor it on subsequent loads. An abort cannot retract an event the collector has already received. Normal `shutdown()` flushes a bounded batch and is not an opt-out.

Pathnames can contain names, emails, order IDs, or access tokens. Hostnames can identify private tenants. Even a UTM value can contain personal data. Piko deliberately avoids unreliable heuristic redaction. Use canonical routes and an allowlist of product categories, booleans, and numeric measurements that you actually need. The generic ingestion API preserves the events you explicitly submit; it cannot determine whether a string is personal information.

## Transport and infrastructure

The browser ingestion client omits cookies and Referer and rejects redirects. Copyable module snippets also use `referrerpolicy="no-referrer"` so loading the tracker does not disclose the embedding URL. Configure the same policy on the host page for other integration styles. Rust telemetry also refuses redirects.

The dashboard forwards only required API/CORS request headers to the Rust service. Browser cookies, referrers, user-agent strings, forwarded client IPs, and Cloudflare user identity headers are not forwarded. Authorization is forwarded only to ingestion, where it contains the product key; management requests do not carry an external user’s authorization header. Configured server-to-server Access credentials remain separate from ingestion keys. Durable refresh notifications contain only a version and affected product IDs (or a full-refresh hint), never event bodies or actor IDs.

Network infrastructure still sees connection information such as IP addresses. Your hosting provider, Cloudflare, reverse proxy, access logs, and backups have their own behavior and retention. Piko's application defaults do not configure those systems or establish legal compliance. Keep management/query access behind the external access boundary described in [access.md](access.md).

## Updating an existing collector

Refresh the hosted tracker or update copied SDK files. Campaign capture now requires an explicit `campaigns` list, and the `respectDoNotTrack` override has been removed. Existing integrations that explicitly request `identity: "persistent"` remain opted in; the new copyable snippet uses `none`.

Changing identity to `none` stops using IDs but does not itself erase IDs from an earlier integration. To clear them, call `optOut()` using the same collector origin and `identityScope` (or key fallback) that created them, then start a new unidentified tracker if collection is still permitted. Previously committed events remain subject to the product's retention window.

## Retention and deletion

Retention is per product; the internal cleanup job runs hourly. Changing the default for new products does not shorten existing products' configured retention. Cleanup logically removes expired rows from the active databases; it is not a secure disk erase. Old backups, snapshots, and migration files require their own retention policy. The original shared `events.duckdb` file retained during migration is outside active cleanup.

There is no automatic personal-data classification or per-person erasure workflow in v1. Minimize collection up front, keep retention short, and verify the stored events in Explore before rolling out a collector broadly.
