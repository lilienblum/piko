export type Properties = Record<string, string | number | boolean>;
export type Event = {
  event_id?: string;
  name: string;
  source: string;
  timestamp?: string;
  actor_id?: string;
  identity_kind?: "visitor" | "installation" | "actor";
  session_id?: string;
  properties?: Properties;
};
export type Ack = { accepted: number; duplicates: number };
export type Options = {
  endpoint: string;
  key: string;
  timeoutMs?: number;
  retries?: number;
  keepalive?: boolean;
  signal?: AbortSignal;
};
export class DeliveryError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "DeliveryError";
  }
}
/** Small dependency-free client. A send's total deadline includes retries and backoff. */
export class Piko {
  private readonly options: Options;
  constructor(options: Options) {
    const timeout = options.timeoutMs ?? 800;
    const retries = options.retries ?? 1;
    if (!Number.isSafeInteger(timeout) || timeout <= 0)
      throw new Error("timeoutMs must be a positive finite integer");
    if (!Number.isSafeInteger(retries) || retries < 0)
      throw new Error("retries must be a nonnegative finite integer");
    const endpoint = new URL(options.endpoint);
    if (
      !["http:", "https:"].includes(endpoint.protocol) ||
      endpoint.username ||
      endpoint.password ||
      endpoint.href.includes("?") ||
      endpoint.href.includes("#")
    )
      throw new Error("endpoint must be an HTTP(S) URL without credentials, query, or fragment");
    if (!options.key.trim() || /[\r\n]/.test(options.key)) throw new Error("key is required");
    this.options = { ...options, endpoint: endpoint.href.replace(/\/+$/, "") };
  }
  send(event: Event): Promise<Ack> {
    return this.sendBatch([event]);
  }
  async sendBatch(events: readonly Event[]): Promise<Ack> {
    if (!events.length || events.length > 100) throw new Error("Send 1–100 events");
    const eventCount = events.length;
    for (const event of events) {
      for (const value of Object.values(event.properties ?? {})) {
        if (
          !["string", "number", "boolean"].includes(typeof value) ||
          (typeof value === "number" && !Number.isFinite(value))
        )
          throw new Error("Properties must be finite numbers, strings, or booleans");
      }
    }
    // IDs and timestamps are materialized ONCE, before all retry attempts.
    const payload = JSON.stringify({
      events: events.map((event) => ({
        ...event,
        event_id: event.event_id ?? crypto.randomUUID(),
        timestamp: event.timestamp ?? new Date().toISOString(),
      })),
    });
    const payloadBytes = new TextEncoder().encode(payload).byteLength;
    if (payloadBytes > 256 * 1024) throw new Error("Batch exceeds the API's 256 KiB body limit");
    // Browsers reject larger keepalive bodies even while the page is still open.
    const keepalive = (this.options.keepalive ?? false) && payloadBytes <= 65_536;
    const timeout = this.options.timeoutMs ?? 800;
    const deadline = Date.now() + timeout;
    const timeoutSignal = AbortSignal.timeout(timeout);
    const signal = this.options.signal
      ? AbortSignal.any([this.options.signal, timeoutSignal])
      : timeoutSignal;
    let lastError: unknown;
    for (let attempt = 0; attempt <= (this.options.retries ?? 1); attempt++) {
      signal.throwIfAborted();
      let backoff = 50 * 2 ** attempt;
      try {
        const response = await fetch(`${this.options.endpoint.replace(/\/$/, "")}/api/ingest`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${this.options.key}`,
          },
          body: payload,
          signal,
          keepalive,
          credentials: "omit",
          referrerPolicy: "no-referrer",
          redirect: "error",
        });
        if (response.ok) {
          const ack = (await response.json()) as Ack | null;
          if (
            !ack ||
            !Number.isSafeInteger(ack.accepted) ||
            !Number.isSafeInteger(ack.duplicates) ||
            ack.accepted < 0 ||
            ack.duplicates < 0 ||
            ack.accepted + ack.duplicates !== eventCount
          )
            throw new DeliveryError("Invalid ingestion acknowledgment", response.status);
          return ack;
        }
        const message = await response.json().catch(() => ({ error: response.statusText }));
        lastError = new DeliveryError(message?.error ?? "Delivery failed", response.status);
        if (response.status < 500 && response.status !== 429) throw lastError;
        const retryAfter = Number(response.headers.get("retry-after") ?? 0);
        if (Number.isFinite(retryAfter)) backoff = Math.max(backoff, retryAfter * 1000);
      } catch (error) {
        if (
          error instanceof DeliveryError &&
          error.status &&
          error.status < 500 &&
          error.status !== 429
        )
          throw error;
        lastError = error;
      }
      if (
        signal.aborted ||
        attempt === (this.options.retries ?? 1) ||
        Date.now() + backoff >= deadline
      )
        break;
      await new Promise<void>((resolve, reject) => {
        const abort = () => {
          clearTimeout(timer);
          reject(signal.reason);
        };
        const timer = setTimeout(() => {
          signal.removeEventListener("abort", abort);
          resolve();
        }, backoff);
        signal.addEventListener("abort", abort, { once: true });
      });
    }
    throw lastError ?? new DeliveryError("Delivery deadline reached");
  }
}
