import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

// Page-level fetch with an explicit error state: without it a failed request
// leaves the page on its skeleton forever, which reads as a hang.
export function useApi<T>(path: string | null): {
  data: T | null;
  error: string | null;
  retry: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (path === null) return;
    let live = true;
    setData(null);
    setError(null);
    api<T>(path)
      .then((result) => {
        if (live) setData(result);
      })
      .catch((e) => {
        if (live) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      live = false;
    };
  }, [path, tick]);

  const retry = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, retry };
}
