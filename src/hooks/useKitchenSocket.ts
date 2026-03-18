"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getKitchenSocketUrl,
  type KitchenSocketMessage,
  type KitchenTicket,
  type KitchenTicketStatus,
} from "@/lib/kitchen-socket";
import { parseKitchenMessage } from "@/app/components/kitchen/kitchen-utils";

type SocketStatus = "connecting" | "connected" | "disconnected";

type UseKitchenSocketOptions = {
  station?: string;
};

export function useKitchenSocket(options?: UseKitchenSocketOptions) {
  const station = options?.station;

  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [socketStatus, setSocketStatus] = useState<SocketStatus>("connecting");
  const [statusMessage, setStatusMessage] = useState("");

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let disposed = false;

    const connect = () => {
      if (disposed) return;

      setSocketStatus("connecting");

      const socketUrl = getKitchenSocketUrl(station);
      const ws = new WebSocket(socketUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (disposed) {
          ws.close();
          return;
        }

        setSocketStatus("connected");
        setStatusMessage("Connected. Waiting for orders...");
      };

      ws.onmessage = (event) => {
        const incoming = parseKitchenMessage(String(event.data));
        if (!incoming) return;

        if (incoming.type === "ORDER_SNAPSHOT") {
          const active = incoming.payload.filter(
            (ticket) => ticket.status !== "done",
          );
          setTickets(active);
          return;
        }

        if (incoming.type === "NEW_ORDER") {
          setTickets((current) => {
            const withoutExisting = current.filter(
              (ticket) => ticket.id !== incoming.payload.id,
            );
            return [incoming.payload, ...withoutExisting];
          });

          setStatusMessage(
            `New ticket #${incoming.payload.orderNumber} received.`,
          );
          return;
        }

        if (incoming.type === "UPDATE_ORDER_STATUS") {
          const { id, status } = incoming.payload;

          setTickets((current) => {
            if (status === "done") {
              return current.filter((ticket) => ticket.id !== id);
            }

            return current.map((ticket) =>
              ticket.id === id ? { ...ticket, status } : ticket,
            );
          });
        }
      };

      ws.onerror = () => {
        setSocketStatus("disconnected");
      };

      ws.onclose = () => {
        if (disposed) return;

        setSocketStatus("disconnected");
        setStatusMessage("Socket disconnected. Retrying...");
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
  }, [station]);

  const activeTickets = useMemo(
    () => tickets.filter((ticket) => ticket.status !== "done"),
    [tickets],
  );

  const updateTicketStatus = (id: string, status: KitchenTicketStatus) => {
    setTickets((current) => {
      if (status === "done") {
        return current.filter((ticket) => ticket.id !== id);
      }

      return current.map((ticket) =>
        ticket.id === id ? { ...ticket, status } : ticket,
      );
    });

    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setStatusMessage("Unable to sync update. Kitchen socket is offline.");
      return;
    }

    const message: KitchenSocketMessage = {
      type: "UPDATE_ORDER_STATUS",
      payload: { id, status },
    };

    socket.send(JSON.stringify(message));
  };

  return {
    tickets,
    activeTickets,
    socketStatus,
    statusMessage,
    updateTicketStatus,
  };
}