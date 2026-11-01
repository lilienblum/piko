import { useEffect, useState } from "react";
import { queryProduct, type QueryResult } from "./api";
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
    queryProduct(product, JSON.parse(key), controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, scope, data });
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted)
          setResult((previous) => ({
            key: requestKey,
            scope,
            data: previous?.scope === scope ? previous.data : undefined,
            error: error.message,
          }));
      });
    return () => controller.abort();
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
