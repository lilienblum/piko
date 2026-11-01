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
  }
}
/** Small dependency-free client. A send's total deadline includes retries and backoff. */
export class Piko {
  constructor(private options: Options) {
    if ((options.timeoutMs ?? 800) <= 0) throw new Error("timeoutMs must be positive");
  }
  send(event: Event): Promise<Ack> {
    return this.sendBatch([event]);
  }
  async sendBatch(events: Event[]): Promise<Ack> {
    if (!events.length || events.length > 100) throw new Error("Send 1–100 events");
    // IDs and timestamps are materialized ONCE, before all retry attempts.
    const payload = JSON.stringify({
      events: events.map((event) => ({
        ...event,
        event_id: event.event_id ?? crypto.randomUUID(),
        timestamp: event.timestamp ?? new Date().toISOString(),
      })),
    });
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
          keepalive: this.options.keepalive ?? false,
          credentials: "omit",
          referrerPolicy: "no-referrer",
          redirect: "error",
        });
        if (response.ok) return (await response.json()) as Ack;
        const message = await response.json().catch(() => ({ error: response.statusText }));
        lastError = new DeliveryError(message.error ?? "Delivery failed", response.status);
        if (response.status < 500 && response.status !== 429) throw lastError;
        backoff = Math.max(backoff, Number(response.headers.get("retry-after") ?? 0) * 1000);
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
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
    throw lastError ?? new DeliveryError("Delivery deadline reached");
  }
}
