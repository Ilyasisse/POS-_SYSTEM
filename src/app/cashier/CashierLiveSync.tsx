"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getKitchenSocketUrl } from "@/lib/kitchen-socket";
import { translateSocketStatus } from "@/lib/ui-text";
import type { SocketStatus } from "@/lib/types";

type CashierLiveSyncProps = {
  intervalMs?: number;
};

export default function CashierLiveSync({
  intervalMs = 5000,
}: CashierLiveSyncProps) {
  const router = useRouter();
  const socketUrl = useMemo(() => getKitchenSocketUrl(), []);
  const [socketStatus, setSocketStatus] =
    useState<SocketStatus>("connecting");
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };

    const timer = window.setInterval(refresh, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [intervalMs, router]);

  useEffect(() => {
    let disposed = false;

    const connect = () => {
      if (disposed || !socketUrl) {
        return;
      }

      setSocketStatus("connecting");

      const ws = new WebSocket(socketUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (disposed) {
          ws.close();
          return;
        }

        setSocketStatus("connected");
      };

      ws.onerror = () => {
        setSocketStatus("disconnected");
      };

      ws.onclose = () => {
        if (disposed) {
          return;
        }

        setSocketStatus("disconnected");
        reconnectTimerRef.current = window.setTimeout(connect, 1500);
      };
    };

    connect();

    return () => {
      disposed = true;

      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }

      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [socketUrl]);

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-50">
      <div
        className={`rounded-full px-4 py-2 text-xs font-semibold uppercase shadow-lg ${
          socketStatus === "connected"
            ? "bg-green-100 text-green-700 ring-1 ring-green-200"
            : socketStatus === "connecting"
              ? "bg-amber-100 text-amber-700 ring-1 ring-amber-200"
              : "bg-red-100 text-red-700 ring-1 ring-red-200"
        }`}
      >
        {translateSocketStatus(socketStatus)}
      </div>
    </div>
  );
}
