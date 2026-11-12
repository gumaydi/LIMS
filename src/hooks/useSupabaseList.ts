import { useCallback, useEffect, useState } from "react";
import type { LoadState } from "../types";
import { clearQueryCache, getCachedQuery, setCachedQuery } from "../lib/queryCache";

type CacheOptions = { cacheKey?: string; maxAgeMs?: number };

export function useSupabaseList<T>(loader: () => Promise<T[]>, options: CacheOptions = {}): LoadState<T[]> & { reload: () => void } {
  const { cacheKey, maxAgeMs = 30_000 } = options;
  const initialCached = cacheKey ? getCachedQuery<T[]>(cacheKey) : null;
  const [state, setState] = useState<LoadState<T[]>>(initialCached ? { status: "success", data: initialCached } : { status: "loading" });
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => {
    if (cacheKey) clearQueryCache(cacheKey);
    setRevision((value) => value + 1);
  }, [cacheKey]);

  useEffect(() => {
    let active = true;
    const cached = cacheKey ? getCachedQuery<T[]>(cacheKey) : null;
    if (cached) {
      setState({ status: "success", data: cached });
      return () => { active = false; };
    }
    setState({ status: "loading" });
    void loader()
      .then((data) => {
        if (cacheKey) setCachedQuery(cacheKey, data, maxAgeMs);
        if (active) setState({ status: "success", data });
      })
      .catch((error: unknown) => {
        if (active) setState({ status: "error", message: error instanceof Error ? error.message : "Data tidak dapat dimuat." });
      });
    return () => { active = false; };
  }, [cacheKey, loader, maxAgeMs, revision]);

  return { ...state, reload };
}
