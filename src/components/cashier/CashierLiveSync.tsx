"use client";

import { useEffect, useState } from "react";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import type { UserRole } from "@prisma/client";
import { useRouter } from "next/navigation";

type CashierLiveSyncProps = {
  currentUserId: string;
  role: UserRole;
};

type RealtimeToken = {
  token: string;
  expiresAt: number | null;
};

export default function CashierLiveSync({
  currentUserId,
  role,
}: CashierLiveSyncProps) {
  const router = useRouter();
  const [connectionFailed, setConnectionFailed] = useState(
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      return;
    }

    let stopped = false;
    let channel: RealtimeChannel | null = null;
    let client: ReturnType<typeof createClient> | null = null;
    let refreshTimer: number | null = null;
    let tokenTimer: number | null = null;

    const refresh = () => {
      if (
        stopped ||
        document.visibilityState !== "visible" ||
        refreshTimer !== null
      )
        return;
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        if (!stopped && document.visibilityState === "visible")
          router.refresh();
      }, 150);
    };

    const readToken = async (): Promise<RealtimeToken> => {
      const response = await fetch("/api/cashier/realtime-token", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Realtime authentication failed.");
      return (await response.json()) as RealtimeToken;
    };

    const renewToken = async () => {
      try {
        const session = await readToken();
        if (stopped || !client) return;
        client.realtime.setAuth(session.token);
        setConnectionFailed(false);
        const delay = session.expiresAt
          ? Math.max(30_000, session.expiresAt * 1000 - Date.now() - 60_000)
          : 45 * 60_000;
        tokenTimer = window.setTimeout(() => void renewToken(), delay);
      } catch {
        if (!stopped) {
          setConnectionFailed(true);
          tokenTimer = window.setTimeout(() => void renewToken(), 30_000);
        }
      }
    };

    const connect = async () => {
      try {
        const session = await readToken();
        if (stopped) return;
        client = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        client.realtime.setAuth(session.token);
        const topic =
          role === "CASHIER" ? `cashier:${currentUserId}` : "cashier:all";
        channel = client
          .channel(topic, { config: { private: true } })
          .on("broadcast", { event: "table_changed" }, refresh)
          .subscribe((status) => {
            if (stopped) return;
            if (status === "SUBSCRIBED") {
              setConnectionFailed(false);
              refresh();
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              setConnectionFailed(true);
            }
          });
        const delay = session.expiresAt
          ? Math.max(30_000, session.expiresAt * 1000 - Date.now() - 60_000)
          : 45 * 60_000;
        tokenTimer = window.setTimeout(() => void renewToken(), delay);
      } catch {
        if (!stopped) setConnectionFailed(true);
      }
    };

    const onReturn = () => {
      if (document.visibilityState === "visible") refresh();
    };

    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    void connect();
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      if (tokenTimer !== null) window.clearTimeout(tokenTimer);
      if (client && channel) void client.removeChannel(channel);
    };
  }, [currentUserId, retry, role, router]);

  if (!connectionFailed) return null;
  return (
    <div
      role="status"
      className="mb-4 rounded-lg border border-amber-500 bg-amber-50 p-3 text-sm text-amber-950"
    >
      Live cashier updates are unavailable. You can refresh to check for new
      table activity.
      <button
        type="button"
        onClick={() => {
          router.refresh();
          setRetry((value) => value + 1);
        }}
        className="ml-2 font-semibold underline"
      >
        Retry connection
      </button>
    </div>
  );
}
