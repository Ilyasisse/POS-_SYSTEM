"use client";

import { useEffect, useReducer, useRef } from "react";
import type { KitchenTicket } from "@/lib/kitchen/kitchen-socket";
import type { SocketStatus } from "@/lib/types";

type WaiterSocketState = {
  socketStatus: SocketStatus;
  statusMessage: string;
};

type WaiterSocketAction =
  | {
      type: "socketStatusChanged";
      socketStatus: SocketStatus;
    }
  | {
      type: "statusMessageChanged";
      statusMessage: string;
    };

const initialWaiterSocketState: WaiterSocketState = {
  socketStatus: "connecting",
  statusMessage: "",
};

function waiterSocketReducer(
  state: WaiterSocketState,
  action: WaiterSocketAction,
): WaiterSocketState {
  switch (action.type) {
    case "socketStatusChanged":
      return {
        ...state,
        socketStatus: action.socketStatus,
      };
    case "statusMessageChanged":
      return {
        ...state,
        statusMessage: action.statusMessage,
      };
  }
}

export function useWaiterSocket(socketUrl: string) {
  const [{ socketStatus, statusMessage }, dispatch] = useReducer(
    waiterSocketReducer,
    initialWaiterSocketState,
  );

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const pendingTicketsRef = useRef<KitchenTicket[]>([]);
  const setStatusMessage = (statusMessage: string) => {
    dispatch({ type: "statusMessageChanged", statusMessage });
  };

  useEffect(() => {
    let disposed = false;
    let activeSocket: WebSocket | null = null;
    let reconnectTimer: number | null = null;

    const connect = () => {
      if (disposed || !socketUrl) return;

      dispatch({ type: "socketStatusChanged", socketStatus: "connecting" });

      const ws = new WebSocket(socketUrl);
      activeSocket = ws;
      socketRef.current = ws;

      ws.onopen = () => {
        if (disposed) {
          ws.close();
          return;
        }

        dispatch({ type: "socketStatusChanged", socketStatus: "connected" });

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
          dispatch({
            type: "statusMessageChanged",
            statusMessage: `Connection restored. ${count} queued ticket(s) were synced.`,
          });
        } else {
          dispatch({
            type: "statusMessageChanged",
            statusMessage: "Connected to the kitchen.",
          });
        }
      };

      ws.onerror = () => {
        dispatch({
          type: "socketStatusChanged",
          socketStatus: "disconnected",
        });
      };

      ws.onclose = () => {
        if (disposed) return;

        dispatch({
          type: "socketStatusChanged",
          socketStatus: "disconnected",
        });
        dispatch({
          type: "statusMessageChanged",
          statusMessage: "Kitchen connection lost. Reconnecting...",
        });
        reconnectTimer = window.setTimeout(connect, 1500);
        reconnectTimerRef.current = reconnectTimer;
      };
    };

    connect();

    return () => {
      disposed = true;

      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }

      if (activeSocket) {
        activeSocket.close();
      }
    };
  }, [socketUrl]);

  const sendKitchenTicket = (ticket: KitchenTicket) => {
    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      pendingTicketsRef.current.push(ticket);
      setStatusMessage("Kitchen is offline. The ticket was queued.");
      return;
    }

    socket.send(
      JSON.stringify({
        type: "NEW_ORDER",
        payload: ticket,
      })
    );

    setStatusMessage(`Ticket #${ticket.orderNumber} was sent to the kitchen.`);
  };

  return {
    socketStatus,
    statusMessage,
    setStatusMessage,
    sendKitchenTicket,
  };
}
