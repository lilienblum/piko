import { useEffect, useState } from "react";
import { api, type QueryResult } from "./api";
export function useQuery(
  product: string | undefined,
  body: Record<string, unknown>,
  refreshKey: string | number = 0,
) {
  const key = JSON.stringify(body);
  const requestKey = `${product}:${refreshKey}:${key}`;
  const [result, setResult] = useState<{ key: string; data?: QueryResult; error?: string }>();
  useEffect(() => {
    if (!product) return;
    const controller = new AbortController();
    api<QueryResult>(`/products/${product}/query`, "POST", JSON.parse(key), controller.signal)
      .then((data) => setResult({ key: requestKey, data }))
      .catch((error: Error) => {
        if (error.name !== "AbortError") setResult({ key: requestKey, error: error.message });
      });
    return () => controller.abort();
  }, [product, key, requestKey]);
  return {
    data: result?.key === requestKey ? result.data : undefined,
    error: result?.key === requestKey ? result.error : undefined,
    loading: result?.key !== requestKey,
  };
}
