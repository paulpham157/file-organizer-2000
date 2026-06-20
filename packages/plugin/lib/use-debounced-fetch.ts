import * as React from "react";

const DEFAULT_DEBOUNCE_MS = 600;
export const ORGANIZER_SECONDARY_DELAY_MS = 250;

/**
 * Runs an async fetch after a debounce delay. Ignores stale responses when deps
 * change before the fetch completes. Does not abort in-flight HTTP calls.
 */
export function useDebouncedFetch(
  fetchFn: () => Promise<void>,
  deps: React.DependencyList,
  debounceMs: number = DEFAULT_DEBOUNCE_MS
): { isFetching: boolean } {
  const [isFetching, setIsFetching] = React.useState(false);
  const requestIdRef = React.useRef(0);
  const fetchRef = React.useRef(fetchFn);
  fetchRef.current = fetchFn;

  React.useEffect(() => {
    const requestId = ++requestIdRef.current;
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        setIsFetching(true);
        try {
          await fetchRef.current();
        } finally {
          if (requestId === requestIdRef.current) {
            setIsFetching(false);
          }
        }
      })();
    }, debounceMs);

    return () => {
      window.clearTimeout(timeoutId);
      requestIdRef.current++;
    };
  }, deps);

  return { isFetching };
}

/**
 * Fetches organizer suggestions with immediate reset/fetch on note switch,
 * and debounced refetch when only content changes on the same note.
 */
export function useOrganizerFetch(
  fetchFn: (signal: AbortSignal) => Promise<void>,
  filePath: string | undefined,
  content: string,
  refreshKey: number,
  onFileContextChange: () => void,
  debounceMs: number = DEFAULT_DEBOUNCE_MS,
  initialDelayMs: number = 0
): void {
  const fetchRef = React.useRef(fetchFn);
  fetchRef.current = fetchFn;
  const onFileContextChangeRef = React.useRef(onFileContextChange);
  onFileContextChangeRef.current = onFileContextChange;
  const prevFilePathRef = React.useRef(filePath);
  const prevRefreshKeyRef = React.useRef(refreshKey);
  const requestIdRef = React.useRef(0);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    const fileChanged = prevFilePathRef.current !== filePath;
    const refreshChanged = prevRefreshKeyRef.current !== refreshKey;
    prevFilePathRef.current = filePath;
    prevRefreshKeyRef.current = refreshKey;

    if (fileChanged || refreshChanged) {
      onFileContextChangeRef.current();
    }

    const delay =
      fileChanged || refreshChanged ? initialDelayMs : debounceMs;
    const requestId = ++requestIdRef.current;

    const timeoutId = window.setTimeout(() => {
      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      void fetchRef.current(abortController.signal).finally(() => {
        if (requestId !== requestIdRef.current) {
          return;
        }
      });
    }, delay);

    return () => {
      window.clearTimeout(timeoutId);
      requestIdRef.current++;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, [filePath, content, refreshKey, debounceMs, initialDelayMs]);
}
