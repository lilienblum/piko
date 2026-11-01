export default async function setup() {
  const response = await fetch(`${process.env.PIKO_API_URL}/api/products`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`E2E API preflight failed (${response.status})`);
  const projects = await response.json();
  if (!Array.isArray(projects) || projects.length !== 0)
    throw new Error("Refusing to run browser tests: their API must have a fresh, empty database.");
}
