"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** 60s fallback keeps reports current when private realtime is unavailable. */
export function useReportRefresh(intervalMs = 60_000) {
  const router = useRouter(); const [lastUpdated, setLastUpdated] = useState(() => new Date()); const busy = useRef(false);
  const refresh = useCallback(() => { if (busy.current) return; busy.current = true; router.refresh(); setLastUpdated(new Date()); window.setTimeout(() => { busy.current = false; }, 300); }, [router]);
  useEffect(() => { const timer = window.setInterval(refresh, intervalMs); return () => window.clearInterval(timer); }, [intervalMs, refresh]);
  return { refresh, lastUpdated };
}
