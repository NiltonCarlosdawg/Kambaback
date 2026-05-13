import { useState, useEffect, useRef, useCallback } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();
const subscribers = new Map<string, Set<() => void>>();

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function notifySubscribers(key: string) {
  const subs = subscribers.get(key);
  if (subs) {
    subs.forEach((cb) => cb());
  }
}

export function useSWR<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: { refreshInterval?: number; dedupingInterval?: number } = {}
) {
  const { refreshInterval, dedupingInterval = 2000 } = options;
  const [data, setData] = useState<T | undefined>(cache.get(key || '')?.data);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(!data);
  const fetchingRef = useRef(false);
  const lastFetchRef = useRef(0);

  const fetchData = useCallback(async () => {
    if (!key) return;
    
    const now = Date.now();
    const cached = cache.get(key);
    
    // Return cached data if valid
    if (cached && now - cached.timestamp < CACHE_TTL && now - lastFetchRef.current > dedupingInterval) {
      setData(cached.data);
      setIsLoading(false);
      return;
    }

    // Prevent duplicate fetches
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    lastFetchRef.current = now;

    try {
      setIsLoading(true);
      const result = await fetcher();
      cache.set(key, { data: result, timestamp: now });
      setData(result);
      setError(null);
      notifySubscribers(key);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [key, fetcher, dedupingInterval]);

  useEffect(() => {
    if (!key) return;

    // Subscribe to cache updates
    const callback = () => {
      const cached = cache.get(key);
      if (cached) {
        setData(cached.data);
      }
    };

    const subs = subscribers.get(key) || new Set();
    subs.add(callback);
    subscribers.set(key, subs);

    // Initial fetch
    fetchData();

    // Refresh interval
    let intervalId: number | undefined;
    if (refreshInterval) {
      intervalId = window.setInterval(fetchData, refreshInterval);
    }

    return () => {
      subs.delete(callback);
      if (intervalId) clearInterval(intervalId);
    };
  }, [key, fetchData, refreshInterval]);

  const mutate = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return { data, error, isLoading, mutate };
}

export function clearCache(key?: string) {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}
