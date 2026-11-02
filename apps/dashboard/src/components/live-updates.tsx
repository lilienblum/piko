import { useCallback, useEffect, useRef, useState } from "react";
import { useChangeChannel } from "@/lib/use-change-channel";
import { parseChangeEnvelope } from "@/lib/change-envelope";

interface Props {
  productId?: string;
  view: string;
  scopeKey: string;
  busy: boolean;
  onRefresh: () => void;
}

export function LiveUpdates(props: Props) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const load = async () => {
      try {
        const response = await fetch("/_piko/runtime", {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5_000)]),
        });
        if (!response.ok) throw new Error("Runtime configuration unavailable");
        const runtime = await response.json();
        if (typeof runtime?.live !== "boolean") throw new Error("Invalid runtime configuration");
        if (!controller.signal.aborted) setEnabled(runtime.live);
      } catch {
        if (!controller.signal.aborted)
          timer = setTimeout(load, Math.min(1_000 * 2 ** attempts++, 30_000));
      }
    };
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);
  return <AutomaticUpdates {...props} live={enabled} />;
}

function AutomaticUpdates({
  productId,
  view,
  scopeKey,
  busy,
  onRefresh,
  live,
}: Props & { live: boolean }) {
  const [dirty, setDirty] = useState(false);
  const [available, setAvailable] = useState(true);
  const lastRefresh = useRef(0);
  const previousScope = useRef(scopeKey);
  const markDirty = useCallback(() => setDirty(true), []);
  useEffect(() => {
    if (previousScope.current !== scopeKey) {
      previousScope.current = scopeKey;
      setDirty(false);
    }
  }, [scopeKey]);
  useEffect(() => {
    const available = () => document.visibilityState === "visible" && navigator.onLine;
    const resume = () => {
      const ready = available();
      setAvailable(ready);
      if (ready) markDirty();
    };
    setAvailable(available());
    // Reconcile even without channels: ephemeral hints may be lost, or collection
    // may be running in standalone mode. Hidden/offline tabs do no polling work.
    const timer = setInterval(() => {
      if (available()) markDirty();
    }, 30_000);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    window.addEventListener("offline", resume);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("offline", resume);
    };
  }, [markDirty]);
  useEffect(() => {
    if (!dirty || !available || busy || !productId || !["/", "/explore"].includes(view)) return;
    // At most one refresh in flight and one queued. Bursts share a short timer.
    const delay = Math.max(750, 1_500 - (Date.now() - lastRefresh.current));
    const timer = setTimeout(() => {
      lastRefresh.current = Date.now();
      setDirty(false);
      onRefresh();
    }, delay);
    return () => clearTimeout(timer);
  }, [dirty, available, busy, productId, view, onRefresh]);
  return live ? <ChangeSubscription productId={productId} onChange={markDirty} /> : null;
}

function ChangeSubscription({ productId, onChange }: { productId?: string; onChange: () => void }) {
  const previousStatus = useRef("connecting");
  const { status } = useChangeChannel((message) => {
    if (message.type !== "changed") return;
    const change = parseChangeEnvelope(message.data);
    if (change && productId && (change.products === null || change.products.includes(productId)))
      onChange();
  });
  useEffect(() => {
    // No replay: reconcile every connection, including the initial subscription.
    if (status === "open" && previousStatus.current !== "open") onChange();
    previousStatus.current = status;
  }, [status, onChange]);
  return null;
}
