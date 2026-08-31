"use client";

import { useCallback, useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";

type GatewayStatus = {
  configured: boolean;
  online: boolean;
  lastHeartbeatAt: string | null;
  staleAfterSeconds: number;
};

export default function PaymentGatewayBanner() {
  const [status, setStatus] = useState<GatewayStatus | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/payment-gateway/status", { cache: "no-store" });
    if (!response.ok) return;
    setStatus(await response.json());
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  if (!status?.configured || status.online) return null;
  const lastSeen = status.lastHeartbeatAt
    ? new Date(status.lastHeartbeatAt).toLocaleString("en-GB", { timeZone: "Africa/Nairobi" })
    : "never";

  return (
    <div role="alert" className="flex items-start gap-3 border-b border-red-300 bg-red-50 px-4 py-3 text-red-950 dark:border-red-900 dark:bg-red-950 dark:text-red-50">
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div>
        <p className="font-semibold">Payment phone is offline</p>
        <p className="text-sm opacity-90">
          No MacroDroid heartbeat has arrived for {status.staleAfterSeconds} seconds. Last seen: {lastSeen}. Check the phone&apos;s internet, battery settings, and MacroDroid log.
        </p>
      </div>
    </div>
  );
}
