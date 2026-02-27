"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getKitchenSocketUrl,
  type KitchenSocketMessage,
  type KitchenTicket,
  type KitchenTicketStatus,
} from "../../lib/kitchen-socket";

type SocketStatus = "connecting" | "connected" | "disconnected";

function parseMessage(raw: string): KitchenSocketMessage | null {
  try {
    return JSON.parse(raw) as KitchenSocketMessage;
  } catch {
    return null;
  }
}

function statusColor(status: KitchenTicketStatus) {
  if (status === "new") {
    return "bg-blue-100 text-blue-700";
  }
  if (status === "in_progress") {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-green-100 text-green-700";
}

export default function KitchenPage() {
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [socketStatus, setSocketStatus] = useState<SocketStatus>("connecting");
  const [statusMessage, setStatusMessage] = useState("");

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let disposed = false;

    const connect = () => {
      if (disposed) {
        return;
      }

      setSocketStatus("connecting");
      const ws = new WebSocket(getKitchenSocketUrl());
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
        const incoming = parseMessage(String(event.data));
        if (!incoming) {
          return;
        }

        if (incoming.type === "ORDER_SNAPSHOT") {
          const active = incoming.payload.filter((ticket) => ticket.status !== "done");
          setTickets(active);
          return;
        }

        if (incoming.type === "NEW_ORDER") {
          setTickets((current) => {
            const withoutExisting = current.filter((ticket) => ticket.id !== incoming.payload.id);
            return [incoming.payload, ...withoutExisting];
          });
          setStatusMessage(`New ticket #${incoming.payload.receiptNo} received.`);
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
        if (disposed) {
          return;
        }
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
  }, []);

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

  return (
    <main
      className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-6 text-slate-100 md:px-6"
      style={{ fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif' }}
    >
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-800/80 p-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Kitchen Display</p>
            <h1 className="text-2xl font-bold">Live Orders</h1>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                socketStatus === "connected"
                  ? "bg-green-900/60 text-green-300"
                  : socketStatus === "connecting"
                    ? "bg-amber-900/60 text-amber-300"
                    : "bg-red-900/60 text-red-300"
              }`}
            >
              {socketStatus}
            </span>
            <span className="rounded-full bg-slate-700 px-3 py-1 text-xs font-semibold uppercase">
              Queue {activeTickets.length}
            </span>
          </div>
        </header>

        {statusMessage ? (
          <p className="rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-slate-300">
            {statusMessage}
          </p>
        ) : null}

        {activeTickets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-800/40 p-8 text-center">
            <p className="text-lg font-semibold text-slate-200">No active kitchen tickets.</p>
            <p className="mt-1 text-sm text-slate-400">New orders from waiter will appear here instantly.</p>
          </div>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {activeTickets.map((ticket) => (
              <article
                key={ticket.id}
                className="rounded-2xl border border-slate-700 bg-slate-800/70 p-4 shadow-lg shadow-black/25"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-300">Ticket #{ticket.receiptNo}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(ticket.createdAt).toLocaleTimeString("en-US")}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold uppercase ${statusColor(ticket.status)}`}>
                    {ticket.status.replace("_", " ")}
                  </span>
                </div>

                <div className="space-y-2">
                  {ticket.items.map((item) => (
                    <div key={`${ticket.id}-${item.id}`} className="flex items-center justify-between rounded-lg bg-slate-700/60 px-3 py-2">
                      <p className="text-sm font-semibold text-slate-100">{item.name}</p>
                      <p className="text-sm font-bold text-blue-300">x{item.quantity}</p>
                    </div>
                  ))}
                </div>

                {ticket.note ? (
                  <p className="mt-3 rounded-lg border border-amber-700/50 bg-amber-900/25 px-3 py-2 text-xs text-amber-200">
                    Note: {ticket.note}
                  </p>
                ) : null}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  {ticket.status === "new" ? (
                    <button
                      type="button"
                      onClick={() => updateTicketStatus(ticket.id, "in_progress")}
                      className="min-h-11 rounded-lg bg-blue-600 text-sm font-semibold text-white"
                    >
                      Start
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => updateTicketStatus(ticket.id, "new")}
                      className="min-h-11 rounded-lg bg-slate-600 text-sm font-semibold text-white"
                    >
                      Reopen
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => updateTicketStatus(ticket.id, "done")}
                    className="min-h-11 rounded-lg bg-green-600 text-sm font-semibold text-white"
                  >
                    Done
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
