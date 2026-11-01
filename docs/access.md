# Cloudflare Access is the authentication boundary

Piko intentionally has **no built-in authentication**. Its API does not validate Access tokens or trust an identity header as an authorization check. Access is enforced before traffic reaches the origin. Keep the origin private: use Cloudflare Tunnel, or an equivalent private network boundary. The Compose API has no published port; the dashboard is bound to localhost by default. Do not expose either service directly to the Internet.

For a deployment at `piko.example.com`:

| Access application path       | Policy                              | Purpose                                                   |
| ----------------------------- | ----------------------------------- | --------------------------------------------------------- |
| `piko.example.com`            | Allow only your chosen users/groups | Dashboard and all management endpoints                    |
| `piko.example.com/api/ingest` | Bypass / Everyone                   | Public write-only collectors and their OPTIONS preflights |
| `piko.example.com/tracker.js` | Bypass / Everyone                   | Public standalone browser module                          |

Create separate path-specific self-hosted Access applications for the two public endpoints. Cloudflare applies more-specific application paths ahead of broader paths; those policies are not inherited from the parent. This is documented in [application path precedence](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/) and [bypassing public endpoints](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/common-policies/).

Do **not** bypass `/api/*`: product creation, key management, cleanup, and analytical queries must remain covered by Access. The tracker is a standalone bundle; its public import needs only `/tracker.js`, not the dashboard's `/assets/*`. Allow preflight OPTIONS on `/api/ingest`; preflight requests carry no Access credentials. The API itself allows only POST ingestion and its CORS preflight on this path, with product-scoped ingestion-key authorization.

Point your Tunnel's hostname at the Bun dashboard (`http://localhost:3000`, or `http://dashboard:3000` from the same container network). The dashboard forwards `/api/*` to the private Rust API. Apply your Access allow policy to the hostname before publishing it. No Cloudflare account or Tunnel is configured automatically by this repository.

Verify from a signed-out browser or unauthenticated client after configuring the edge:

- `/`, `/explore`, `/settings`, and `/api/products` require Access authentication.
- `/api/products/<id>/query`, product/key mutation paths, and `/api/cleanup` cannot bypass Access.
- `/tracker.js` loads as a public JavaScript module with CORS.
- `OPTIONS /api/ingest` succeeds; `POST /api/ingest` without an ingestion key returns 401; a valid ingestion key can only send to its own product.
- The origin address/port is unreachable directly from the Internet.

Access configuration is deployment-specific and was not provisioned or verified against a live Cloudflare account during local development. The local tests verify API scoping, the CSRF marker, CORS, and browser tracking; they do not assert that an external Access policy is installed.

## Two Tako hosts and realtime

With the Tako configs, route `piko.example.com` to the dashboard and `piko-api.example.com` to the independent API. Both origins must remain private/protected. Keep the dashboard's `/_tako/channels/*` receive endpoint under the same Access user policy as the dashboard: it carries workspace-wide product identifiers, and channel parameters are not an authorization boundary.

The API needs server-to-server access to **only** `POST piko.example.com/_piko/changes`. A narrow path-specific Access bypass can expose this endpoint because the application itself checks the separate `PIKO_CHANGE_TOKEN` bearer secret before publishing. Missing/wrong credentials fail; the token is never embedded in browser code. Never bypass `/_piko/*` or `/_tako/*` broadly. The public ingestion key does not authorize notifications, queries, or management.

Protect the API host with a service-auth Access policy for the dashboard gateway, or keep its origin reachable only through a private route. When using service authentication, store `PIKO_API_ACCESS_CLIENT_ID` and `PIKO_API_ACCESS_CLIENT_SECRET` through Tako secrets for the dashboard. The gateway attaches those headers server-side while preserving ingestion's separate bearer key. Keep public browser/CLI collection through the dashboard's narrow `/api/ingest` route; the direct API host need not have a public ingestion bypass.

Verify `/_piko/changes` without its secret returns401, `/_tako/channels/*` redirects or denies a signed-out user at Access, and the direct API host cannot be reached without its service credential. For API updates, block both the gateway's upstream path and direct ingress before scaling to zero; see [Tako maintenance](tako.md#production-and-updates).
