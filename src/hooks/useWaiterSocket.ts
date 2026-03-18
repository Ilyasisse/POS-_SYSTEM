"use client";

import { useEffect, useRef, useState } from "react";
import type { KitchenTicket } from "@/lib/kitchen-socket";
import type { SocketStatus } from "@/lib/types";

export function useWaiterSocket(socketUrl: string) {
  const [socketStatus, setSocketStatus] =
    useState<SocketStatus>("connecting");
  const [statusMessage, setStatusMessage] = useState("");

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const pendingTicketsRef = useRef<KitchenTicket[]>([]);

  useEffect(() => {
    let disposed = false;

    const connect = () => {
      if (disposed || !socketUrl) return;

      setSocketStatus("connecting");

      const ws = new WebSocket(socketUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (disposed) {
          ws.close();
          return;
        }

        setSocketStatus("connected");

        if (pendingTicketsRef.current.length > 0) {
          pendingTicketsRef.current.forEach((ticket) => {
            ws.send(
              JSON.stringify({
                type: "NEW_ORDER",
                payload: ticket,
              })
            );
          });

          const count = pendingTicketsRef.current.length;
          pendingTicketsRef.current = [];
          setStatusMessage(`Reconnected. Synced ${count} queued ticket(s).`);
        } else {
          setStatusMessage("Connected to kitchen.");
        }
      };

      ws.onerror = () => {
        setSocketStatus("disconnected");
      };

      ws.onclose = () => {
        if (disposed) return;

        setSocketStatus("disconnected");
        setStatusMessage("Kitchen socket disconnected. Retrying...");
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

  const sendKitchenTicket = (ticket: KitchenTicket) => {
    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      pendingTicketsRef.current.push(ticket);
      setStatusMessage("Kitchen offline. Ticket queued.");
      return;
    }

    socket.send(
      JSON.stringify({
        type: "NEW_ORDER",
        payload: ticket,
      })
    );

    setStatusMessage(`Ticket #${ticket.orderNumber} sent to kitchen.`);
  };

  return {
    socketStatus,
    statusMessage,
    setStatusMessage,
    sendKitchenTicket,
  };
}
