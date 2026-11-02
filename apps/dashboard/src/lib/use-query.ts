import { useEffect, useState } from "react";
import { ApiError, queryProduct, type QueryResult } from "./api";
export function useQuery(
  product: string | undefined,
  body: Record<string, unknown>,
  refreshKey: string | number = 0,
  backgroundScope?: string,
) {
  const key = JSON.stringify(body);
  const requestKey = `${product}:${refreshKey}:${key}`;
  // Only a caller's explicit unchanged scope may keep data during a background refresh.
  const scope = backgroundScope === undefined ? requestKey : `${product}:${backgroundScope}`;
  const [result, setResult] = useState<{
    key: string;
    scope: string;
    data?: QueryResult;
    error?: string;
  }>();
  useEffect(() => {
    if (!product) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const load = async () => {
      try {
        const data = await queryProduct(product, JSON.parse(key), controller.signal);
        if (!controller.signal.aborted) setResult({ key: requestKey, scope, data });
      } catch (error) {
        if (controller.signal.aborted) return;
        setResult((previous) => ({
          key: requestKey,
          scope,
          data: previous?.scope === scope ? previous.data : undefined,
          error: error instanceof Error ? error.message : "Could not load analytics",
        }));
        // Recover transient failures without a click. Scope changes cancel both
        // requests and retries; the visible-tab reconciliation handles longer outages.
        const transient =
          !(error instanceof ApiError) || error.status >= 500 || error.status === 429;
        if (transient && attempts < 3 && document.visibilityState === "visible" && navigator.onLine)
          timer = setTimeout(
            () => {
              if (document.visibilityState === "visible" && navigator.onLine) void load();
            },
            1_000 * 2 ** attempts++,
          );
      }
    };
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [product, key, requestKey, scope]);
  const current = result?.key === requestKey;
  const data = result?.scope === scope ? result.data : undefined;
  return {
    data,
    error: current ? result.error : undefined,
    loading: !current && !data,
    refreshing: !current,
  };
}
