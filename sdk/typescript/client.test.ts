import { afterEach, expect, test } from "bun:test";
import { Piko, type Properties } from "./client";
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

test("JavaScript properties are never silently coerced to null or dropped", async () => {
  let attempts = 0;
  globalThis.fetch = (async () => {
    attempts++;
    return Response.json({ accepted: 1, duplicates: 0 });
  }) as unknown as typeof fetch;
  const client = new Piko({ endpoint: "http://localhost", key: "key" });
  for (const value of [NaN, Infinity, null, undefined, [], {}, 1n]) {
    await expect(
      client.send({ name: "test", source: "sdk", properties: { value } as unknown as Properties }),
    ).rejects.toThrow("Properties must be");
  }
  expect(attempts).toBe(0);
});

test("malformed or inconsistent acknowledgments do not report successful delivery", async () => {
  let attempts = 0;
  for (const ack of [
    null,
    {},
    { accepted: 1 },
    { accepted: -1, duplicates: 2 },
    { accepted: 2, duplicates: 0 },
    { accepted: 0.5, duplicates: 0.5 },
  ]) {
    globalThis.fetch = (async () => {
      attempts++;
      return Response.json(ack);
    }) as unknown as typeof fetch;
    await expect(
      new Piko({ endpoint: "http://localhost", key: "key" }).send({ name: "test", source: "sdk" }),
    ).rejects.toThrow("Invalid ingestion acknowledgment");
  }
  expect(attempts).toBe(6);
});

test("batch count and serialized byte limits fail before sending", async () => {
  let attempts = 0;
  globalThis.fetch = (async () => {
    attempts++;
    return Response.json({ accepted: 1, duplicates: 0 });
  }) as unknown as typeof fetch;
  const client = new Piko({ endpoint: "http://localhost", key: "key" });
  const event = { name: "test", source: "sdk" };
  await expect(client.sendBatch([])).rejects.toThrow("1–100");
  await expect(client.sendBatch(Array(101).fill(event))).rejects.toThrow("1–100");
  await expect(
    client.send({ ...event, properties: { large: "東京".repeat(50_000) } }),
  ).rejects.toThrow("256 KiB");
  expect(attempts).toBe(0);
});

test("constructor snapshots options and supports an endpoint path prefix", async () => {
  const options = { endpoint: "https://example.com/piko///", key: "original" };
  const client = new Piko(options);
  options.endpoint = "https://unexpected.example";
  options.key = "changed";
  globalThis.fetch = (async (input: unknown, init: RequestInit) => {
    expect(input).toBe("https://example.com/piko/api/ingest");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer original");
    const event = JSON.parse(init.body as string).events[0];
    expect(event.event_id).toBe("stable");
    expect(event.timestamp).toBe("2026-11-02T00:00:00Z");
    return Response.json({ accepted: 0, duplicates: 1 });
  }) as typeof fetch;
  expect(
    await client.send({
      name: "test",
      source: "sdk",
      event_id: "stable",
      timestamp: "2026-11-02T00:00:00Z",
    }),
  ).toEqual({ accepted: 0, duplicates: 1 });
});

test("invalid endpoints cannot carry credentials, queries, or fragments", () => {
  for (const endpoint of [
    "ftp://example.com",
    "https://user:pass@example.com",
    "https://example.com/?key=x",
    "https://example.com/#fragment",
    "https://example.com/?",
    "https://example.com/#",
  ]) {
    expect(() => new Piko({ endpoint, key: "key" })).toThrow();
  }
  for (const key of ["", " ", "key\r\nother: header"]) {
    expect(() => new Piko({ endpoint: "https://example.com", key })).toThrow();
  }
});

test("mutating the caller's batch during delivery does not change acknowledgment validation", async () => {
  const events = [{ name: "test", source: "sdk" }];
  globalThis.fetch = (async () => {
    events.length = 0;
    return Response.json({ accepted: 1, duplicates: 0 });
  }) as unknown as typeof fetch;
  const client = new Piko({ endpoint: "http://localhost", key: "key" });
  expect(await client.sendBatch(events)).toEqual({ accepted: 1, duplicates: 0 });
});
