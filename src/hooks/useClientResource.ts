"use client";

import { useEffect, useEffectEvent } from "react";

type ClientResourceOptions<T> = {
  load: (signal: AbortSignal) => Promise<T>;
  onData: (data: T) => void;
  onError?: (error: unknown) => void;
  enabled?: boolean;
  intervalMs?: number;
  onlyWhenVisible?: boolean;
};

export function useClientResource<T>({
  load,
  onData,
  onError,
  enabled = true,
  intervalMs,
  onlyWhenVisible = false,
}: ClientResourceOptions<T>) {
  const receive = useEffectEvent(onData);
  const handleError = useEffectEvent((error: unknown) => onError?.(error));

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    let pending = false;

    async function refresh() {
      if (pending || (onlyWhenVisible && document.visibilityState !== "visible")) return;
      pending = true;
      try {
        const data = await load(controller.signal);
        if (!controller.signal.aborted) receive(data);
      } catch (error) {
        if (!controller.signal.aborted) handleError(error);
      } finally {
        pending = false;
      }
    }

    void refresh();
    if (intervalMs === undefined) return () => controller.abort();

    const interval = window.setInterval(refresh, intervalMs);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [enabled, intervalMs, load, onlyWhenVisible]);
}
