// Exercises the actual Rust example against a local API, and verifies typed output.
export {};

const endpoint = process.env.PIKO_API_URL ?? "http://127.0.0.1:3001";
async function request(path: string, body: unknown) {
  const response = await fetch(`${endpoint}/api${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-piko-admin": "1" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}
const product = await request("/products", {
  name: "Rust CLI example",
  kind: "tool",
  retention_days: 30,
});
const { key } = await request(`/products/${product.id}/keys`, { label: "CLI example" });
const from = new Date().toISOString();
async function run(command: string, overrides: Record<string, string | undefined>) {
  const child = Bun.spawn(["cargo", "run", "-p", "piko", "--example", "cli", "--", command], {
    env: {
      ...process.env,
      PIKO_ENDPOINT: endpoint,
      PIKO_INGESTION_KEY: key,
      PIKO_TELEMETRY: "1",
      DO_NOT_TRACK: "0",
      PIKO_INSTALLATION_ID: undefined,
      ...overrides,
    },
    stdout: "ignore",
    stderr: "pipe",
  });
  const [code, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
  if (code !== 0) throw new Error(`CLI example failed: ${stderr}`);
}
async function query() {
  return request(`/products/${product.id}/query`, {
    from,
    to: new Date(Date.now() + 1000).toISOString(),
  });
}
await run("build", { PIKO_TELEMETRY: undefined });
await run("build", { DO_NOT_TRACK: "1" });
if ((await query()).summary.total !== 0)
  throw new Error("CLI emitted telemetry without opt-in or despite Do Not Track");

await run("build", { PIKO_INSTALLATION_ID: "example-installation" });
const identified = await query();
if (
  identified.summary.total !== 1 ||
  identified.summary.installations !== 1 ||
  identified.events[0].properties.success !== true ||
  typeof identified.events[0].properties.duration_ms !== "number"
)
  throw new Error("CLI example event did not round-trip correctly");

await run("private-command-argument", {});
const anonymous = await query();
if (
  anonymous.summary.total !== 2 ||
  anonymous.events[0].properties.command !== "other" ||
  anonymous.events[0].actor_id !== null
)
  throw new Error(
    "CLI command arguments were not redacted or anonymous identity was not preserved",
  );
console.log(
  "Verified Rust CLI opt-in, Do Not Track, command redaction, identity, and typed duration.",
);
