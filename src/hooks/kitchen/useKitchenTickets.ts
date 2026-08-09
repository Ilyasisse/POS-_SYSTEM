"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getKitchenTicketStatusForItems,
  setKitchenTicketPickupStatus,
  setKitchenTicketStationStatus,
  type KitchenStation,
  type KitchenTicket,
  type KitchenTicketPickupStatus,
  type KitchenTicketStatus,
  type KitchenViewerRole,
} from "@/lib/kitchen/kitchen-socket";

type UseKitchenTicketsOptions = {
  station?: string | null;
  currentUserId?: string | null;
  currentUserName?: string | null;
  currentUserRole?: KitchenViewerRole | null;
};

type TicketResponse =
  { ok: true; tickets: KitchenTicket[] } | { error?: string };

const KITCHEN_REFRESH_INTERVAL_MS = 5000;

async function readError(response: Response) {
  const body = (await response.json().catch(() => null)) as {
    error?: unknown;
  } | null;
  return typeof body?.error === "string"
    ? body.error
    : "Unable to synchronize kitchen tickets.";
}

export function useKitchenTickets(options?: UseKitchenTicketsOptions) {
  const station = options?.station as KitchenStation | undefined;
  const currentUserId = options?.currentUserId ?? null;
  const currentUserName = options?.currentUserName ?? null;
  const currentUserRole = options?.currentUserRole ?? null;
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const requestSequence = useRef(0);
  const refreshTimer = useRef<number | null>(null);

  const refreshTickets = useCallback(async () => {
    const sequence = ++requestSequence.current;
    const params = new URLSearchParams();

    // Non-admin station filtering is derived on the server from the session.
    if (station && currentUserRole === "ADMIN") {
      params.set("station", station);
    }

    const response = await fetch(
      `/api/kitchen/tickets${params.size > 0 ? `?${params.toString()}` : ""}`,
      { cache: "no-store" },
    );
    const payload = (await response
      .json()
      .catch(() => null)) as TicketResponse | null;

    if (sequence !== requestSequence.current) return;

    if (!response.ok || !payload || !("tickets" in payload)) {
      setStatusMessage(
        payload && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "Unable to load kitchen tickets.",
      );
      return;
    }

    setTickets(payload.tickets);
  }, [currentUserRole, station]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current !== null) return;

    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null;
      void refreshTickets();
    }, 150);
  }, [refreshTickets]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshTickets();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [refreshTickets]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshTickets();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (refreshTimer.current !== null) {
        window.clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }
    };
  }, [refreshTickets]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        scheduleRefresh();
      }
    }, KITCHEN_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [scheduleRefresh]);

  const activeTickets = useMemo(
    () =>
      currentUserRole === "WAITER" || (currentUserRole === "ADMIN" && !station)
        ? tickets.filter(
            (ticket) =>
              getKitchenTicketStatusForItems(ticket, ticket.items) === "done" &&
              ticket.pickupStatus !== "delivered",
          )
        : tickets.filter(
            (ticket) =>
              getKitchenTicketStatusForItems(ticket, ticket.items) !== "done",
          ),
    [currentUserRole, station, tickets],
  );

  const updateTicketStatus = useCallback(
    async (id: string, status: KitchenTicketStatus) => {
      if (!station) {
        setStatusMessage("Open a station queue to change ticket status.");
        return;
      }

      setTickets((current) =>
        current.map((ticket) =>
          ticket.id === id
            ? setKitchenTicketStationStatus(ticket, station, status)
            : ticket,
        ),
      );

      const response = await fetch(
        `/api/kitchen/tickets/${encodeURIComponent(id)}/station`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ station, status }),
        },
      );

      if (!response.ok) {
        setStatusMessage(await readError(response));
      }

      await refreshTickets();
    },
    [refreshTickets, station],
  );

  const updatePickupStatus = useCallback(
    async (id: string, pickupStatus: KitchenTicketPickupStatus) => {
      if (pickupStatus !== "claimed" && pickupStatus !== "delivered") {
        return;
      }

      const currentTicket = tickets.find((ticket) => ticket.id === id);
      const claimedByWaiterId =
        pickupStatus === "claimed"
          ? currentUserId
          : currentTicket?.claimedByWaiterId;
      const claimedByWaiterName =
        pickupStatus === "claimed"
          ? currentUserName
          : currentTicket?.claimedByWaiterName;

      setTickets((current) =>
        current
          .map((ticket) =>
            ticket.id === id
              ? setKitchenTicketPickupStatus(
                  ticket,
                  pickupStatus,
                  claimedByWaiterId,
                  claimedByWaiterName,
                )
              : ticket,
          )
          .filter((ticket) => ticket.pickupStatus !== "delivered"),
      );

      const response = await fetch(
        `/api/kitchen/tickets/${encodeURIComponent(id)}/pickup`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pickupStatus }),
        },
      );

      if (!response.ok) {
        setStatusMessage(await readError(response));
      }

      await refreshTickets();
    },
    [currentUserId, currentUserName, refreshTickets, tickets],
  );

  const recordQualityEvent = useCallback(
    async (
      id: string,
      type: "LATE" | "REMAKE" | "WRONG_ORDER" | "WAITER_MISTAKE",
      reason: string,
    ) => {
      const response = await fetch(
        `/api/kitchen/tickets/${encodeURIComponent(id)}/quality`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ station, type, reason }),
        },
      );
      setStatusMessage(
        response.ok ? "Quality event recorded." : await readError(response),
      );
    },
    [station],
  );

  return {
    tickets,
    activeTickets,
    statusMessage,
    updateTicketStatus,
    updatePickupStatus,
    recordQualityEvent,
  };
}
