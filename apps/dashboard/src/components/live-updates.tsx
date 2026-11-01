import { useEffect, useRef, useState } from "react";
import { useChangeChannel } from "@/lib/use-change-channel";
import { parseChangeEnvelope } from "@/lib/change-envelope";

interface Props {
  productId?: string;
  view: string;
  scopeKey: string;
  busy: boolean;
  onPending: (pending: boolean) => void;
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
  return enabled ? <ChannelStatus {...props} /> : null;
}

function ChannelStatus({ productId, view, scopeKey, busy, onPending, onRefresh }: Props) {
  const [dirty, setDirty] = useState(false);
  const [visible, setVisible] = useState(true);
  const previousStatus = useRef("connecting");
  const lastRefresh = useRef(0);
  const previousScope = useRef(scopeKey);
  const { status } = useChangeChannel((message) => {
    if (message.type !== "changed") return;
    const change = parseChangeEnvelope(message.data);
    if (change && productId && (change.products === null || change.products.includes(productId)))
      setDirty(true);
  });
  useEffect(() => {
    // No replay: reconcile every connection, including changes between the initial
    // query and first subscription. Explore offers a refresh without replacing results.
    if (status === "open" && previousStatus.current !== "open") setDirty(true);
    previousStatus.current = status;
  }, [status]);
  useEffect(() => {
    if (previousScope.current !== scopeKey) {
      previousScope.current = scopeKey;
      setDirty(false);
    }
  }, [scopeKey]);
  useEffect(() => {
    const visibility = () => {
      const shown = document.visibilityState === "visible";
      setVisible(shown);
      if (shown) setDirty(true);
    };
    setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);
  useEffect(() => {
    onPending(dirty && view === "/explore");
  }, [dirty, view, onPending]);
  useEffect(() => {
    if (!dirty || !visible || busy || !productId || view !== "/") return;
    // At most one refresh in flight and one queued. Bursts share a short timer.
    const delay = Math.max(750, 1_500 - (Date.now() - lastRefresh.current));
    const timer = setTimeout(() => {
      lastRefresh.current = Date.now();
      setDirty(false);
      onRefresh();
    }, delay);
    return () => clearTimeout(timer);
  }, [dirty, visible, busy, productId, view, onRefresh]);
  const label = !visible ? "Paused" : status === "open" ? "Live" : "Reconnecting";
  return (
    <span
      className="live-status"
      data-live-state={label.toLowerCase()}
      role="status"
      aria-label={`Live updates: ${label.toLowerCase()}`}
      title={
        !visible
          ? "Updates resume when this tab is visible"
          : status === "open"
            ? "Overview updates automatically; Explore keeps your current results until refreshed"
            : "Reconnecting to live updates. You can still refresh manually."
      }
    >
      <span className="live-dot" aria-hidden="true" />
      <span className="live-label">{label}</span>
    </span>
  );
}
