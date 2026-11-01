import { expect, mock, test } from "bun:test";

mock.module("tako.sh", () => ({
  tako: {
    secrets: {
      PIKO_API_ACCESS_CLIENT_ID: "service-id",
      PIKO_API_ACCESS_CLIENT_SECRET: "service-secret",
    },
  },
}));
const { proxyApi } = await import("../apps/dashboard/src/server/api-gateway");

test("gateway preserves API semantics while stripping browser identity and cookies", async () => {
  const received: { url: string; method: string; headers: Headers; body: string }[] = [];
  const upstream = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      received.push({
        url: request.url,
        method: request.method,
        headers: request.headers,
        body: await request.text(),
      });
      return Response.json({ accepted: 1, duplicates: 0 });
    },
  });
  const previous = process.env.PIKO_API_URL;
  process.env.PIKO_API_URL = upstream.url.toString();
  try {
    const body = JSON.stringify({ event_id: "example", name: "build", source: "cli" });
    const response = await proxyApi(
      new Request("https://dashboard.example/api/ingest?example=1", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          authorization: "Bearer public-ingestion-key",
          "x-piko-admin": "1",
          origin: "https://site.example",
          cookie: "session=browser-session",
          referer: "https://site.example/account?token=private",
          "user-agent": "Private browser fingerprint",
          "x-forwarded-for": "192.0.2.1",
          "cf-connecting-ip": "192.0.2.1",
          "cf-access-authenticated-user-email": "private@example.com",
          "cf-access-jwt-assertion": "browser-jwt",
          "cf-access-client-id": "untrusted-id",
          "cf-access-client-secret": "untrusted-secret",
          "x-custom-identity": "private",
        },
        body,
      }),
    );
    expect(response.ok).toBe(true);
    expect(received).toHaveLength(1);
    const request = received[0];
    expect(new URL(request.url).pathname + new URL(request.url).search).toBe(
      "/api/ingest?example=1",
    );
    expect(request.method).toBe("POST");
    expect(request.body).toBe(body);
    expect(request.headers.get("authorization")).toBe("Bearer public-ingestion-key");
    expect(request.headers.get("x-piko-admin")).toBe("1");
    expect(request.headers.get("origin")).toBe("https://site.example");
    expect(request.headers.get("cf-access-client-id")).toBe("service-id");
    expect(request.headers.get("cf-access-client-secret")).toBe("service-secret");
    for (const name of [
      "cookie",
      "referer",
      "x-forwarded-for",
      "cf-connecting-ip",
      "cf-access-authenticated-user-email",
      "cf-access-jwt-assertion",
      "x-custom-identity",
    ])
      expect(request.headers.has(name)).toBe(false);
    expect(request.headers.get("user-agent")).not.toBe("Private browser fingerprint");

    await proxyApi(
      new Request("https://dashboard.example/api/ingest", {
        method: "OPTIONS",
        headers: {
          origin: "https://site.example",
          "access-control-request-method": "POST",
          "access-control-request-headers": "authorization, content-type",
        },
      }),
    );
    expect(received[1].method).toBe("OPTIONS");
    expect(received[1].headers.get("access-control-request-method")).toBe("POST");
    expect(received[1].headers.get("access-control-request-headers")).toBe(
      "authorization, content-type",
    );
    await proxyApi(
      new Request("https://dashboard.example/api/products", {
        headers: { authorization: "Basic external-user-credential" },
      }),
    );
    expect(received[2].headers.has("authorization")).toBe(false);
    expect(received[2].headers.get("cf-access-client-id")).toBe("service-id");
  } finally {
    if (previous === undefined) delete process.env.PIKO_API_URL;
    else process.env.PIKO_API_URL = previous;
    upstream.stop(true);
  }
});

test("gateway bounds pending uploads, cancels them, and releases admission slots", async () => {
  const controllers = Array.from({ length: 64 }, () => new AbortController());
  const pending = controllers.map((controller) =>
    proxyApi(
      new Request("https://dashboard.example/api/ingest", {
        method: "POST",
        signal: controller.signal,
        body: new ReadableStream(),
      }),
    ),
  );
  try {
    const overloaded = await proxyApi(
      new Request("https://dashboard.example/api/ingest", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(overloaded.status).toBe(503);
    expect(overloaded.headers.get("retry-after")).toBe("1");
    expect(overloaded.headers.get("access-control-expose-headers")).toBe("Retry-After");
    expect(overloaded.headers.get("access-control-allow-origin")).toBe("*");
  } finally {
    for (const controller of controllers) controller.abort();
    expect((await Promise.all(pending)).every((response) => response.status === 503)).toBe(true);
  }
  // Reaching body validation proves the slots were released. No upstream request is needed.
  const oversized = await proxyApi(
    new Request("https://dashboard.example/api/ingest", {
      method: "POST",
      body: "{}",
      headers: { "content-length": "262145" },
    }),
  );
  expect(oversized.status).toBe(413);
  expect(oversized.headers.get("access-control-allow-origin")).toBe("*");
});
