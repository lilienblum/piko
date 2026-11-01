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

test("delivery does not attach credentials or referrer and rejects redirects", async () => {
  globalThis.fetch = (async (_input: unknown, init: RequestInit) => {
    expect(init.credentials).toBe("omit");
    expect(init.referrerPolicy).toBe("no-referrer");
    expect(init.redirect).toBe("error");
    return Response.json({ accepted: 1, duplicates: 0 });
  }) as typeof fetch;
  await new Piko({ endpoint: "http://localhost", key: "key" }).send({
    name: "test",
    source: "sdk",
  });
});

test("aborted delivery never starts a request or retries after cancellation", async () => {
  const controller = new AbortController();
  let attempts = 0;
  globalThis.fetch = (async () => {
    attempts++;
    controller.abort();
    return new Response("{}", { status: 503 });
  }) as unknown as typeof fetch;
  const client = new Piko({ endpoint: "http://localhost", key: "key", signal: controller.signal });
  await expect(client.send({ name: "test", source: "sdk" })).rejects.toThrow();
  expect(attempts).toBe(1);
  await expect(client.send({ name: "test", source: "sdk" })).rejects.toThrow();
  expect(attempts).toBe(1);
});

test("307 responses cannot forward event bodies to another endpoint", async () => {
  let received = 0;
  const destination = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch() {
      received++;
      return Response.json({ accepted: 1, duplicates: 0 });
    },
  });
  const redirect = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () =>
      new Response(null, { status: 307, headers: { location: String(destination.url) } }),
  });
  try {
    await expect(
      new Piko({ endpoint: String(redirect.url), key: "key", retries: 0 }).send({
        name: "private_event",
        source: "sdk",
        properties: { confidential: "not forwarded" },
      }),
    ).rejects.toThrow();
    expect(received).toBe(0);
  } finally {
    await redirect.stop(true);
    await destination.stop(true);
  }
});

test("cancellation interrupts retry backoff immediately", async () => {
  const controller = new AbortController();
  globalThis.fetch = (async () =>
    new Response("{}", {
      status: 503,
      headers: { "retry-after": "2" },
    })) as unknown as typeof fetch;
  const pending = new Piko({
    endpoint: "http://localhost",
    key: "key",
    timeoutMs: 5000,
    signal: controller.signal,
  }).send({ name: "test", source: "sdk" });
  // Allow the first response to enter its two-second retry backoff.
  await Bun.sleep(20);
  const started = performance.now();
  controller.abort();
  await expect(pending).rejects.toThrow();
  expect(performance.now() - started).toBeLessThan(250);
});

test("non-object error responses do not retry permanent failures", async () => {
  let attempts = 0;
  globalThis.fetch = (async () => {
    attempts++;
    return Response.json(null, { status: 400 });
  }) as unknown as typeof fetch;
  await expect(
    new Piko({ endpoint: "http://localhost", key: "key" }).send({
      name: "test",
      source: "sdk",
    }),
  ).rejects.toThrow("Delivery failed");
  expect(attempts).toBe(1);
});

test("delivery limits must be finite integers", () => {
  for (const timeoutMs of [NaN, Infinity, 0, -1, 1.5])
    expect(() => new Piko({ endpoint: "http://localhost", key: "key", timeoutMs })).toThrow();
  for (const retries of [NaN, Infinity, -1, 0.5])
    expect(() => new Piko({ endpoint: "http://localhost", key: "key", retries })).toThrow();
});
