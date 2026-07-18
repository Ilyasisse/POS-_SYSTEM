"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const KITCHEN_TICKETS_TOPIC = "kitchen:tickets";

/** Subscribes to database-triggered invalidation events for kitchen tickets. */
export function useKitchenRealtimeSubscription(onTicketChanged: () => void) {
  const callbackRef = useRef(onTicketChanged);

  useEffect(() => {
    callbackRef.current = onTicketChanged;
  }, [onTicketChanged]);

  useEffect(() => {
    const supabase = createClient();
    let disposed = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const start = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (disposed) return;

      if (!session?.access_token) {
        return;
      }

      await supabase.realtime.setAuth(session.access_token);
      if (disposed) return;

      channel = supabase
        .channel(KITCHEN_TICKETS_TOPIC, { config: { private: true } })
        .on("broadcast", { event: "ticket_changed" }, () => {
          callbackRef.current();
        })
        .subscribe((status) => {
          if (disposed) return;

          if (status === "SUBSCRIBED") {
            callbackRef.current();
          }
        });
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        void supabase.realtime.setAuth(session.access_token);
      }
    });

    void start();

    return () => {
      disposed = true;
      subscription.unsubscribe();
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, []);

}
