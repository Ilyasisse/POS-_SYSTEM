"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { useRouter } from "next/navigation";
import { getKitchenSocketUrl } from "@/lib/kitchen/kitchen-socket";
import { translateSocketStatus } from "@/lib/ui/ui-text";
import type { SocketStatus } from "@/lib/types";

type CashierLiveSyncProps = {
  intervalMs?: number;
};

const REFRESH_DEBOUNCE_MS = 500;

function parseSocketMessage(raw: string): { type?: string } | null {
  try {
    const message = JSON.parse(raw) as { type?: unknown };

    return typeof message.type === "string" ? { type: message.type } : null;
  } catch {
    return null;
  }
}

export default function CashierLiveSync({
  intervalMs = 30000,
}: CashierLiveSyncProps) {
  const router = useRouter();
  const socketUrl = useMemo(() => getKitchenSocketUrl(), []);
  const [socketStatus, setSocketStatus] = useReducer(
    (_current: SocketStatus, next: SocketStatus) => next,
    "connecting" as SocketStatus,
  );
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  // Keep dashboard totals fresh without refreshing cashier order-entry routes.
  const scheduleRefresh = useCallback(() => {
    if (document.visibilityState !== "visible" || refreshTimerRef.current) {
      return;
    }

    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;

      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }, REFRESH_DEBOUNCE_MS);
  }, [router]);

  const clearScheduledRefresh = useCallback(() => {
    const refreshTimer = refreshTimerRef.current;

    if (refreshTimer) {
      window.clearTimeout(refreshTimer);
      refreshTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(scheduleRefresh, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [intervalMs, scheduleRefresh]);

  useEffect(() => {
    let disposed = false;
    let activeSocket: WebSocket | null = null;
    let reconnectTimer: number | null = null;

    const connect = () => {
      if (disposed || !socketUrl) {
        return;
      }

      setSocketStatus("connecting");

      const ws = new WebSocket(socketUrl);
      activeSocket = ws;
      socketRef.current = ws;

      ws.onopen = () => {
        if (disposed) {
          ws.close();
          return;
        }

        setSocketStatus("connected");
      };

      ws.onmessage = (event) => {
        const message = parseSocketMessage(String(event.data));

        if (
          message?.type === "NEW_ORDER" ||
          message?.type === "UPDATE_ORDER_STATUS"
        ) {
          scheduleRefresh();
        }
      };

      ws.onerror = () => {
        setSocketStatus("disconnected");
      };

      ws.onclose = () => {
        if (disposed) {
          return;
        }

        setSocketStatus("disconnected");
        reconnectTimer = window.setTimeout(connect, 1000);
        reconnectTimerRef.current = reconnectTimer;
      };
    };

    connect();

    return () => {
      disposed = true;

      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }

      clearScheduledRefresh();

      if (activeSocket) {
        activeSocket.close();
      }
    };
  }, [clearScheduledRefresh, scheduleRefresh, socketUrl]);

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
