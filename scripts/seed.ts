import { Piko, type Event } from "../sdk/typescript/client";
const endpoint = process.env.PIKO_API_URL ?? "http://127.0.0.1:3001";
async function admin<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${endpoint}/api${path}`, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json", "x-piko-admin": "1" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}
const existing = await admin<{ id: string; name: string }[]>("/products");
const today = new Date();
today.setUTCHours(0, 0, 0, 0);
for (const [name, kind] of [
  ["Orbit website", "website"],
  ["Orbit CLI", "tool"],
] as const) {
  const product =
    existing.find((p) => p.name === name) ??
    (await admin<{ id: string }>("/products", { name, kind, retention_days: 90 }));
  const { key } = await admin<{ key: string }>(`/products/${product.id}/keys`, {
    label: "Sample data generator",
  });
  const client = new Piko({ endpoint, key, timeoutMs: 10000, retries: 2 });
  let events: Event[] = [];
  let total = 0;
  for (let day = 29; day >= 0; day--) {
    const count =
      kind === "website"
        ? 140 + (29 - day) * 7 + Math.round(Math.sin(day * 1.5) * 45)
        : 80 + (29 - day) * 3 + Math.round(Math.cos(day) * 23);
    for (let i = 0; i < count; i++) {
      const timestamp = new Date(
        today.getTime() -
          day * 86400000 +
          Math.floor((i / count) * (day === 0 ? Date.now() - today.getTime() : 86400000)),
      );
      events.push(
        kind === "website"
          ? {
              event_id: `demo-web-${timestamp.toISOString().slice(0, 10)}-${i}`,
              name: i % 19 === 0 ? "signup" : "page_view",
              source: "browser",
              timestamp: timestamp.toISOString(),
              actor_id: `visitor-${day % 6}-${Math.floor(i / 3) % Math.max(1, Math.floor(count * 0.65))}`,
              identity_kind: "visitor",
              session_id: `session-${day}-${Math.floor(i / 3)}`,
              properties: {
                path: ["/", "/docs", "/pricing", "/blog", "/docs/getting-started", "/changelog"][
                  i % 10 < 5 ? 0 : 1 + (i % 5)
                ],
                referrer: ["Direct", "google.com", "github.com", "news.ycombinator.com", "t.co"][
                  i % 5
                ],
                utm_source: i % 3 === 0 ? "newsletter" : "organic",
                subscribed: i % 19 === 0,
              },
            }
          : {
              event_id: `demo-cli-${timestamp.toISOString().slice(0, 10)}-${i}`,
              name: i % 23 === 0 ? "config_updated" : "command_run",
              source: "cli",
              timestamp: timestamp.toISOString(),
              actor_id: `installation-${i % 86}`,
              identity_kind: "installation",
              properties: {
                command: ["build", "dev", "deploy", "init", "check"][i % 5],
                version: i % 8 === 0 ? "1.3.0" : "1.4.2",
                os: ["macos", "linux", "windows"][i % 7 < 4 ? 0 : (i % 2) + 1],
                arch: i % 3 === 0 ? "x86_64" : "aarch64",
                success: i % 17 !== 0,
                duration_ms: 80 + ((i * 37 + day * 19) % 2400),
              },
            },
      );
      if (events.length === 100) {
        const ack = await client.sendBatch(events);
        total += ack.accepted;
        events = [];
      }
    }
  }
  if (events.length) total += (await client.sendBatch(events)).accepted;
  console.log(`${name}: ${total} committed sample events (${product.id})`);
}
