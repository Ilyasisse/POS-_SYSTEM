"use client";
// import { useCallback, useEffect, useRef, useState } from "react";
// import { useRouter } from "next/navigation";

/** 60s fallback keeps reports current when private realtime is unavailable. */
// function useReportRefresh(intervalMs = 60_000) {
//   // Refreshes report routes on demand and on a fallback interval while tracking the last update time. Preserved for future use.
//   const router = useRouter();
//   const [lastUpdated, setLastUpdated] = useState(() => new Date());
//   const busy = useRef(false);
//   const refresh = useCallback(() => {
//     if (busy.current) return;
//     busy.current = true;
//     router.refresh();
//     setLastUpdated(new Date());
//     window.setTimeout(() => {
//       busy.current = false;
//     }, 300);
//   }, [router]);
//   useEffect(() => {
//     const timer = window.setInterval(refresh, intervalMs);
//     return () => window.clearInterval(timer);
//   }, [intervalMs, refresh]);
//   return { refresh, lastUpdated };
// }
