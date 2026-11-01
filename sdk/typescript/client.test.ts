import { afterEach, expect, test } from "bun:test";
import { Piko } from "./client";
const original = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = original;
});
test("retries preserve event IDs, timestamps and property types", async () => {
  const payloads: string[] = [];
  globalThis.fetch = (async (_input: unknown, init: RequestInit) => {
    payloads.push(init.body as string);
    return payloads.length === 1
      ? new Response("{}", { status: 503 })
      : Response.json({ accepted: 1, duplicates: 0 });
  }) as typeof fetch;
  const result = await new Piko({ endpoint: "http://localhost", key: "key", timeoutMs: 1000 }).send(
    { name: "test", source: "cli", properties: { count: 12, success: true, version: "1" } },
  );
  expect(result.accepted).toBe(1);
  expect(payloads).toHaveLength(2);
  expect(payloads[0]).toBe(payloads[1]);
  expect(JSON.parse(payloads[0]).events[0].properties).toEqual({
    count: 12,
    success: true,
    version: "1",
  });
});
test("validation failures are not retried", async () => {
  let attempts = 0;
  globalThis.fetch = (async () => {
    attempts++;
    return Response.json({ error: "Invalid event" }, { status: 400 });
  }) as unknown as typeof fetch;
  await expect(
    new Piko({ endpoint: "http://localhost", key: "key" }).send({ name: "bad", source: "cli" }),
  ).rejects.toThrow("Invalid event");
  expect(attempts).toBe(1);
});
test("retry-after cannot extend total deadline", async () => {
  globalThis.fetch = (async () =>
    new Response("{}", {
      status: 503,
      headers: { "retry-after": "10" },
    })) as unknown as typeof fetch;
  const start = performance.now();
  await expect(
    new Piko({ endpoint: "http://localhost", key: "key", timeoutMs: 80 }).send({
      name: "test",
      source: "cli",
    }),
  ).rejects.toThrow();
  expect(performance.now() - start).toBeLessThan(150);
});
