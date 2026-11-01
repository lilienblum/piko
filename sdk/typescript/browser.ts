import { Piko, type Event, type Options, type Properties } from "./client";
const campaignParams = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;
export type CampaignParam = (typeof campaignParams)[number];
export type BrowserOptions = Options & {
  enabled?: boolean;
  identity?: "none" | "persistent";
  identityScope?: string;
  campaigns?: readonly CampaignParam[];
  collectReferrer?: boolean;
  sanitizePath?: (path: string) => string | null;
  beforeSend?: (event: Event) => Event | null;
  capacity?: number;
};
/** No identity or campaign values by default. The host application owns consent. */
export function startBrowserTracker(options: BrowserOptions) {
  const namespace = `piko:${new URL(options.endpoint, location.href).origin}:${options.identityScope ?? options.key}`;
  const campaignKeys = campaignParams.filter((key) => options.campaigns?.includes(key));
  const queue: Event[] = [];
  const delivery = new AbortController();
  let running: Promise<void> | undefined;
  let stopped = false;
  let optedOut = false;
  let actor: string | undefined;
  let cleanup = () => {};
  const privacyBlocked = () =>
    options.enabled === false ||
    options.signal?.aborted === true ||
    navigator.doNotTrack === "1" ||
    (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
  function stop() {
    stopped = true;
    cleanup();
  }
  function optOut() {
    optedOut = true;
    stop();
    queue.length = 0;
    delivery.abort();
    actor = undefined;
    try {
      localStorage.removeItem(`${namespace}:visitor`);
      localStorage.removeItem(`${namespace}:session`);
    } catch {
      /* Storage may be unavailable; collection is still stopped. */
    }
  }
  function canTrack() {
    if (stopped) return false;
    if (!privacyBlocked()) return true;
    optOut();
    return false;
  }
  function identity(): Pick<Event, "actor_id" | "identity_kind" | "session_id"> {
    if (!actor) return {};
    try {
      const raw = localStorage.getItem(`${namespace}:session`);
      const previous = raw ? (JSON.parse(raw) as { id: string; seen: number }) : undefined;
      const session = {
        id:
          previous && Date.now() - previous.seen < 30 * 60 * 1000
            ? previous.id
            : crypto.randomUUID(),
        seen: Date.now(),
      };
      localStorage.setItem(`${namespace}:session`, JSON.stringify(session));
      return { actor_id: actor, identity_kind: "visitor", session_id: session.id };
    } catch {
      actor = undefined;
      return {};
    }
  }
  function track(name: string, properties: Properties = {}) {
    if (!canTrack() || queue.length >= (options.capacity ?? 100)) return false;
    const event: Event = {
      event_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      name,
      source: "browser",
      properties: { ...properties },
      ...identity(),
    };
    try {
      const accepted = options.beforeSend ? options.beforeSend(event) : event;
      if (!accepted || !canTrack()) return false;
      queue.push({ ...accepted, properties: { ...accepted.properties } });
    } catch {
      return false;
    }
    if (queue.length >= 20) void flush();
    return true;
  }
  function pageView() {
    if (!canTrack()) return false;
    const url = new URL(location.href);
    const properties: Properties = {};
    try {
      const path = options.sanitizePath ? options.sanitizePath(url.pathname) : url.pathname;
      if (path !== null) properties.path = path;
    } catch {
      return false;
    }
    if (options.collectReferrer !== false) {
      try {
        properties.referrer = document.referrer ? new URL(document.referrer).hostname : "Direct";
      } catch {
        properties.referrer = "Direct";
      }
    }
    for (const key of campaignKeys) {
      const value = url.searchParams.get(key);
      if (value) properties[key] = value.slice(0, 2048);
    }
    return track("page_view", properties);
  }
  function flush(): Promise<void> {
    if (optedOut) return Promise.resolve();
    if (privacyBlocked()) {
      optOut();
      return Promise.resolve();
    }
    if (running) return running;
    const batch = queue.splice(0, 20);
    if (!batch.length) return Promise.resolve();
    running = client
      .sendBatch(batch)
      .then(
        () => {},
        () => {}, // Best effort: retries are bounded; drop failed batches.
      )
      .finally(() => {
        running = undefined;
      });
    return running;
  }
  const tracker = {
    track,
    pageView,
    flush,
    optOut,
    async shutdown() {
      stop();
      await flush();
    },
  };
  if (privacyBlocked()) {
    stopped = true;
    optedOut = true;
    return tracker;
  }
  const client = new Piko({
    ...options,
    keepalive: true,
    signal: options.signal ? AbortSignal.any([options.signal, delivery.signal]) : delivery.signal,
  });
  if (options.identity === "persistent") {
    try {
      const stored = localStorage.getItem(`${namespace}:visitor`) ?? crypto.randomUUID();
      localStorage.setItem(`${namespace}:visitor`, stored);
      actor = stored;
    } catch {
      /* Storage denied: anonymous events, no fingerprint fallback. */
    }
  }
  let previous = location.pathname + location.search;
  const navigation = () => {
    const next = location.pathname + location.search;
    if (next !== previous) {
      previous = next;
      pageView();
    }
  };
  const push = history.pushState;
  const replace = history.replaceState;
  const wrappedPush: History["pushState"] = function (this: History, ...args) {
    push.apply(this, args);
    navigation();
  };
  const wrappedReplace: History["replaceState"] = function (this: History, ...args) {
    replace.apply(this, args);
    navigation();
  };
  const pageHide = () => {
    void flush();
  };
  const timer = setInterval(() => void flush(), 2000);
  cleanup = () => {
    clearInterval(timer);
    removeEventListener("popstate", navigation);
    removeEventListener("pagehide", pageHide);
    options.signal?.removeEventListener("abort", optOut);
    if (history.pushState === wrappedPush) history.pushState = push;
    if (history.replaceState === wrappedReplace) history.replaceState = replace;
  };
  history.pushState = wrappedPush;
  history.replaceState = wrappedReplace;
  addEventListener("popstate", navigation);
  addEventListener("pagehide", pageHide);
  options.signal?.addEventListener("abort", optOut, { once: true });
  pageView();
  return tracker;
}
