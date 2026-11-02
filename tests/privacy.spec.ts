import { expect, test, type Page } from "@playwright/test";
import type { Event } from "../sdk/typescript/client";
import type { startBrowserTracker } from "../sdk/typescript/browser";

declare global {
  interface Window {
    tracker: ReturnType<typeof startBrowserTracker>;
    shutdownPending: Promise<void>;
    originalPush: History["pushState"];
    originalReplace: History["replaceState"];
    retained: Event;
    storageCalls: number;
    timerCalls: number;
    listenerCalls: number;
    privacySignal: boolean;
  }
}

const dashboard = process.env.PIKO_DASHBOARD_URL ?? "http://127.0.0.1:3000";
let source: string;
test.beforeAll(async () => {
  const response = await fetch(`${dashboard}/tracker.js`);
  expect(response.ok).toBe(true);
  source = await response.text();
});
async function fixture(options = "", hold = false, redirect?: string) {
  const requests: { events: Event[]; headers: Record<string, string> }[] = [];
  const modules: string[] = [];
  let release = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === "/tracker.js") {
        modules.push(request.headers.get("referer") ?? "");
        return new Response(source, { headers: { "content-type": "application/javascript" } });
      }
      if (path === "/api/ingest") {
        const body = await request.arrayBuffer();
        if (body.byteLength > 262_144) return new Response("Body too large", { status: 413 });
        const { events } = JSON.parse(new TextDecoder().decode(body));
        requests.push({ events, headers: Object.fromEntries(request.headers) });
        if (redirect) return new Response(null, { status: 307, headers: { location: redirect } });
        if (hold) await pending;
        return Response.json({ accepted: events.length, duplicates: 0 });
      }
      return new Response(
        `<html><body>Privacy fixture<script type="module" referrerpolicy="no-referrer">
        import {startBrowserTracker} from '/tracker.js';
        window.originalPush = history.pushState;
        window.originalReplace = history.replaceState;
        window.tracker = startBrowserTracker({endpoint:location.origin,key:'public-key',identityScope:'privacy-product',${options}});
      </script></body></html>`,
        {
          headers: {
            "content-type": "text/html",
            "set-cookie": "private_session=do-not-send; Path=/",
          },
        },
      );
    },
  });
  return { server, requests, modules, release };
}
async function open(page: Page, url: URL, referer?: string) {
  await page.goto(
    `${url}account?email=private%40example.com&utm_source=newsletter&utm_campaign=private-campaign#secret`,
    { referer },
  );
  await page.waitForFunction(() => !!window.tracker);
}

test("default browser collection has no IDs, campaigns, cookies, or Referer headers", async ({
  page,
}) => {
  const f = await fixture();
  try {
    await open(page, f.server.url, "https://source.example/private?email=private%40example.com");
    await page.evaluate(async () => {
      const properties = { count: 3, paid: true, plan: "pro" };
      window.tracker.track("signup", properties);
      properties.plan = "private mutation";
      await window.tracker.flush();
    });
    expect(f.requests).toHaveLength(1);
    const { events, headers } = f.requests[0];
    expect(headers.cookie).toBeUndefined();
    expect(headers.referer).toBeUndefined();
    expect(f.modules).toEqual([""]);
    expect(events[0].properties).toEqual({ path: "/account", referrer: "source.example" });
    expect(events[1].properties).toEqual({ count: 3, paid: true, plan: "pro" });
    for (const event of events) {
      expect(event.actor_id).toBeUndefined();
      expect(event.session_id).toBeUndefined();
      expect(event.identity_kind).toBeUndefined();
    }
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  } finally {
    await f.server.stop(true);
  }
});

for (const signal of ["disabled", "dnt", "gpc"] as const) {
  test(`${signal} starts an inert tracker without storage, hooks, timers, or delivery`, async ({
    page,
  }) => {
    await page.addInitScript((signal) => {
      window.storageCalls = 0;
      window.timerCalls = 0;
      window.listenerCalls = 0;
      const addListener = window.addEventListener;
      window.addEventListener = ((...args: Parameters<typeof window.addEventListener>) => {
        if (args[0] === "popstate" || args[0] === "pagehide") window.listenerCalls++;
        return addListener(...args);
      }) as typeof window.addEventListener;
      for (const key of ["getItem", "setItem", "removeItem"] as const) {
        const original = Storage.prototype[key];
        Object.defineProperty(Storage.prototype, key, {
          value: function (...args: string[]) {
            window.storageCalls++;
            return Reflect.apply(original, this, args);
          },
        });
      }
      const interval = window.setInterval;
      window.setInterval = ((...args: Parameters<typeof setInterval>) => {
        window.timerCalls++;
        return interval(...args);
      }) as typeof setInterval;
      if (signal === "dnt") Object.defineProperty(navigator, "doNotTrack", { value: "1" });
      if (signal === "gpc")
        Object.defineProperty(navigator, "globalPrivacyControl", { value: true });
    }, signal);
    const f = await fixture(
      `identity:'persistent',${signal === "disabled" ? "enabled:false," : ""}`,
    );
    try {
      await open(page, f.server.url);
      const state = await page.evaluate(async () => {
        const tracked = window.tracker.track("blocked", { secret: "not collected" });
        window.tracker.pageView();
        await window.tracker.flush();
        await window.tracker.shutdown();
        return {
          tracked,
          storage: window.storageCalls,
          timers: window.timerCalls,
          listeners: window.listenerCalls,
          push: history.pushState === window.originalPush,
          replace: history.replaceState === window.originalReplace,
        };
      });
      expect(state).toEqual({
        tracked: false,
        storage: 0,
        timers: 0,
        listeners: 0,
        push: true,
        replace: true,
      });
      expect(f.requests).toHaveLength(0);
    } finally {
      await f.server.stop(true);
    }
  });
}

test("explicit campaign and identity choices work with fail-closed event sanitization", async ({
  page,
}) => {
  const f =
    await fixture(`identity:'persistent',campaigns:['utm_source','email'],collectReferrer:false,
    sanitizePath:()=>'/account/:id',beforeSend:event=>{
      if(event.name==='drop')return null;
      if(event.name==='throw')throw new Error('bad sanitizer');
      if(event.name==='page_view')event.properties.reviewed=true;
      if(event.name==='custom')event.properties={count:event.properties.count,paid:event.properties.paid,plan:'safe'};
      window.retained=event; return event;
    }`);
  try {
    await open(page, f.server.url);
    expect(
      await page.evaluate(async () => {
        const dropped = window.tracker.track("drop", { secret: "not sent" });
        const threw = window.tracker.track("throw", { secret: "not sent" });
        window.tracker.track("custom", { count: 2, paid: true, plan: "private" });
        if (window.retained.properties) window.retained.properties.plan = "mutated later";
        await window.tracker.flush();
        return { dropped, threw };
      }),
    ).toEqual({ dropped: false, threw: false });
    const events = f.requests[0].events;
    expect(events).toHaveLength(2);
    expect(events[0].properties).toEqual({
      path: "/account/:id",
      utm_source: "newsletter",
      reviewed: true,
    });
    expect(events[1].properties).toEqual({ count: 2, paid: true, plan: "safe" });
    expect(events[0].actor_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(events[0].session_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(events[1].actor_id).toBe(events[0].actor_id);
    await page.reload();
    await page.waitForFunction(() => !!window.tracker);
    await page.evaluate(() => window.tracker.flush());
    expect(f.requests[1].events[0].actor_id).toBe(events[0].actor_id);
    expect(f.requests[1].events[0].session_id).toBe(events[0].session_id);
  } finally {
    await f.server.stop(true);
  }
});

test("opt-out discards queued data, clears only scoped IDs, and restores navigation", async ({
  page,
}) => {
  const f = await fixture("identity:'persistent',sanitizePath:()=>null,collectReferrer:false");
  try {
    await open(page, f.server.url);
    await page.evaluate(() => window.tracker.flush());
    expect(f.requests[0].events[0].properties).toEqual({});
    const state = await page.evaluate(async () => {
      localStorage.setItem("unrelated", "keep");
      window.tracker.track("queued", { secret: "never delivered" });
      window.tracker.optOut();
      const accepted = window.tracker.track("later");
      history.pushState({}, "", "/another");
      await window.tracker.flush();
      await window.tracker.shutdown();
      return {
        accepted,
        storage: { ...localStorage },
        push: history.pushState === window.originalPush,
      };
    });
    expect(state).toEqual({ accepted: false, storage: { unrelated: "keep" }, push: true });
    expect(f.requests).toHaveLength(1);
  } finally {
    await f.server.stop(true);
  }
});

test("privacy signals are checked again before delivery and discard queued identity data", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.privacySignal = false;
    Object.defineProperty(navigator, "globalPrivacyControl", { get: () => window.privacySignal });
  });
  const f = await fixture("identity:'persistent'");
  try {
    await open(page, f.server.url);
    await page.evaluate(async () => {
      window.privacySignal = true;
      await window.tracker.flush();
    });
    expect(f.requests).toHaveLength(0);
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
    expect(await page.evaluate(() => history.pushState === window.originalPush)).toBe(true);
  } finally {
    await f.server.stop(true);
  }
});

test("opt-out aborts an in-flight delivery and prevents retry", async ({ page }) => {
  const f = await fixture("identity:'persistent',timeoutMs:5000", true);
  try {
    await open(page, f.server.url);
    await page.evaluate(() => {
      void window.tracker.flush();
    });
    await expect.poll(() => f.requests.length).toBe(1);
    const requestFailed = page.waitForEvent("requestfailed", {
      predicate: (request) => request.url().endsWith("/api/ingest"),
    });
    await page.evaluate(async () => {
      window.tracker.optOut();
      await window.tracker.flush();
      await window.tracker.shutdown();
    });
    await requestFailed;
    expect(f.requests).toHaveLength(1);
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  } finally {
    f.release();
    await f.server.stop(true);
  }
});

test("browser ingestion refuses redirects without forwarding events", async ({ page }) => {
  let forwarded = 0;
  const destination = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch() {
      forwarded++;
      return Response.json({ accepted: 1, duplicates: 0 });
    },
  });
  const f = await fixture("", false, String(destination.url));
  try {
    await open(page, f.server.url);
    await page.evaluate(() => window.tracker.shutdown());
    expect(f.requests).toHaveLength(2);
    expect(forwarded).toBe(0);
    expect(f.requests[0].events).toEqual(f.requests[1].events);
    expect(await page.evaluate(() => window.tracker.track("after_shutdown"))).toBe(false);
  } finally {
    await f.server.stop(true);
    await destination.stop(true);
  }
});

for (const method of ["getItem", "setItem"] as const) {
  test(`session ${method} failure falls back to unidentified events`, async ({ page }) => {
    await page.addInitScript((method) => {
      const original = Storage.prototype[method];
      Object.defineProperty(Storage.prototype, method, {
        value: function (...args: string[]) {
          if (args[0].endsWith(":session")) throw new DOMException("Storage unavailable");
          return Reflect.apply(original, this, args);
        },
      });
    }, method);
    const f = await fixture("identity:'persistent'");
    try {
      await open(page, f.server.url);
      await page.evaluate(async () => {
        window.tracker.track("later");
        await window.tracker.shutdown();
      });
      expect(f.requests).toHaveLength(1);
      expect(f.requests[0].events).toHaveLength(2);
      for (const event of f.requests[0].events) {
        expect(event.actor_id).toBeUndefined();
        expect(event.identity_kind).toBeUndefined();
        expect(event.session_id).toBeUndefined();
      }
    } finally {
      await f.server.stop(true);
    }
  });
}

test("shutdown drains events queued behind an in-flight batch", async ({ page }) => {
  const f = await fixture("timeoutMs:5000", true);
  try {
    await open(page, f.server.url);
    await page.evaluate(() => {
      for (let i = 0; i < 45; i++) window.tracker.track("queued", { index: i });
      window.shutdownPending = window.tracker.shutdown();
    });
    await expect.poll(() => f.requests.length).toBe(1);
    f.release();
    await page.evaluate(() => window.shutdownPending);
    expect(f.requests.map(({ events }) => events.length)).toEqual([20, 20, 6]);
    const events = f.requests.flatMap(({ events }) => events);
    expect(new Set(events.map((event) => event.event_id)).size).toBe(46);
    expect(await page.evaluate(() => window.tracker.track("after_shutdown"))).toBe(false);
    expect(await page.evaluate(() => history.pushState === window.originalPush)).toBe(true);
  } finally {
    f.release();
    await f.server.stop(true);
  }
});

test("shutdown has one deadline for the whole queue and discards leftovers", async ({ page }) => {
  const f = await fixture("timeoutMs:120", true);
  try {
    await open(page, f.server.url);
    const result = await page.evaluate(async () => {
      // Observe starts in the browser: a cancelled request can reach the server after shutdown.
      const originalFetch = window.fetch;
      let attempts = 0;
      window.fetch = new Proxy(originalFetch, {
        apply(target, receiver, args) {
          attempts++;
          return Reflect.apply(target, receiver, args);
        },
      });
      try {
        for (let i = 0; i < 80; i++) window.tracker.track("queued");
        const started = performance.now();
        await window.tracker.shutdown();
        const elapsed = performance.now() - started;
        const beforeFlush = attempts;
        await window.tracker.flush();
        return { elapsed, beforeFlush, afterFlush: attempts };
      } finally {
        window.fetch = originalFetch;
      }
    });
    expect(result.elapsed).toBeLessThan(400);
    expect(result.afterFlush).toBe(result.beforeFlush);
  } finally {
    f.release();
    await f.server.stop(true);
  }
});

test("byte-heavy events split into bounded batches and deliver while the page is open", async ({
  page,
}) => {
  const f = await fixture();
  try {
    await open(page, f.server.url);
    await page.evaluate(async () => {
      // 32 valid 2048-byte strings exceed keepalive's 64 KiB budget after JSON framing.
      const properties = Object.fromEntries(
        Array.from({ length: 32 }, (_, i) => [`field_${i}`, "é".repeat(1024)]),
      );
      for (let i = 0; i < 5; i++) window.tracker.track("large", properties);
      await window.tracker.shutdown();
    });
    const events = f.requests.flatMap(({ events }) => events);
    expect(events).toHaveLength(6);
    expect(new Set(events.map((event) => event.event_id)).size).toBe(6);
    const large = events.filter((event) => event.name === "large");
    expect(large).toHaveLength(5);
    for (const event of large) expect(event.properties?.field_0).toBe("é".repeat(1024));
  } finally {
    await f.server.stop(true);
  }
});
