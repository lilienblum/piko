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
const child = Bun.spawn(["cargo", "run", "-p", "piko", "--example", "cli", "--", "build"], {
  env: {
    ...process.env,
    PIKO_ENDPOINT: endpoint,
    PIKO_INGESTION_KEY: key,
    PIKO_INSTALLATION_ID: "example-installation",
  },
  stdout: "inherit",
  stderr: "inherit",
});
if ((await child.exited) !== 0) throw new Error("CLI example failed");
const result = await request(`/products/${product.id}/query`, {
  from: new Date(Date.now() - 60000).toISOString(),
  to: new Date(Date.now() + 1000).toISOString(),
});
if (
  result.summary.total !== 1 ||
  result.summary.installations !== 1 ||
  result.events[0].properties.success !== true ||
  typeof result.events[0].properties.duration_ms !== "number"
)
  throw new Error("CLI example event did not round-trip correctly");
console.log(
  `Verified Rust CLI example: 1 execution, 1 installation, numeric duration. Product: ${product.name}`,
);
