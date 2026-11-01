import { Piko, type Event, type Options, type Properties } from "./client";
export type BrowserOptions = Options & {
  identity?: "none" | "persistent";
  identityScope?: string;
  respectDoNotTrack?: boolean;
  sanitizePath?: (path: string) => string;
  capacity?: number;
};
/** No identity by default. Call only after any consent required by your application. */
export function startBrowserTracker(options: BrowserOptions) {
  const client = new Piko({ ...options, keepalive: true });
  const disabled = options.respectDoNotTrack !== false && navigator.doNotTrack === "1";
  const namespace = `piko:${new URL(options.endpoint, location.href).origin}:${options.identityScope ?? options.key}`;
  const queue: Event[] = [];
  let running: Promise<void> | undefined;
  let stopped = false;
  let actor: string | undefined;
  if (!disabled && options.identity === "persistent") {
    try {
      actor = localStorage.getItem(`${namespace}:visitor`) ?? crypto.randomUUID();
      localStorage.setItem(`${namespace}:visitor`, actor);
    } catch {
      /* Storage denied: anonymous events, no fingerprint fallback. */
    }
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
      return { actor_id: actor, identity_kind: "visitor" };
    }
  }
  function track(name: string, properties: Properties = {}) {
    if (disabled || stopped || queue.length >= (options.capacity ?? 100)) return false;
    queue.push({
      event_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      name,
      source: "browser",
      properties,
      ...identity(),
    });
    if (queue.length >= 20) void flush();
    return true;
  }
  function pageView() {
    const url = new URL(location.href);
    const properties: Properties = { path: options.sanitizePath?.(url.pathname) ?? url.pathname };
    try {
      properties.referrer = document.referrer ? new URL(document.referrer).hostname : "Direct";
    } catch {
      properties.referrer = "Direct";
    }
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
      const value = url.searchParams.get(key);
      if (value) properties[key] = value.slice(0, 2048);
    }
    track("page_view", properties);
  }
  function flush(): Promise<void> {
    if (running) return running;
    running = (async () => {
      const batch = queue.splice(0, 20);
      if (batch.length)
        try {
          await client.sendBatch(batch);
        } catch {
          /* Best effort: retries are bounded; drop failed batch. */
        }
    })().finally(() => {
      running = undefined;
    });
    return running;
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
  history.pushState = wrappedPush;
  history.replaceState = wrappedReplace;
  const pageHide = () => {
    void flush();
  };
  addEventListener("popstate", navigation);
  addEventListener("pagehide", pageHide);
  const timer = setInterval(() => void flush(), 2000);
  pageView();
  return {
    track,
    pageView,
    flush,
    async shutdown() {
      stopped = true;
      clearInterval(timer);
      removeEventListener("popstate", navigation);
      removeEventListener("pagehide", pageHide);
      if (history.pushState === wrappedPush) history.pushState = push;
      if (history.replaceState === wrappedReplace) history.replaceState = replace;
      await flush();
    },
  };
}
