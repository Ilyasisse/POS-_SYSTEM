"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type CashierLiveSyncProps = {
  intervalMs?: number;
};

const REFRESH_DEBOUNCE_MS = 500;

export default function CashierLiveSync({
  intervalMs = 10000,
}: CashierLiveSyncProps) {
  const router = useRouter();
  const refreshTimerRef = useRef<number | null>(null);

  const scheduleRefresh = useCallback(() => {
    if (document.visibilityState !== "visible" || refreshTimerRef.current) {
      return;
    }

    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      if (document.visibilityState === "visible") router.refresh();
    }, REFRESH_DEBOUNCE_MS);
  }, [router]);

  useEffect(() => {
    const timer = window.setInterval(scheduleRefresh, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, scheduleRefresh]);

  useEffect(
    () => () => {
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    },
    [],
  );

  return null;
}
