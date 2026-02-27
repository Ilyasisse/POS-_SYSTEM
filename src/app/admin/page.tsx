"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getKitchenSocketUrl,
  type KitchenSocketMessage,
  type SaleRecord,
} from "../../lib/kitchen-socket";

type SocketStatus = "connecting" | "connected" | "disconnected";

type WaiterSummary = {
  waiterName: string;
  orders: number;
  total: number;
};

function parseMessage(raw: string): KitchenSocketMessage | null {
  try {
    return JSON.parse(raw) as KitchenSocketMessage;
  } catch {
    return null;
  }
}

function toDayKey(dateInput: string) {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function money(value: number) {
  return currency.format(value);
}

export default function AdminPage() {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [day, setDay] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [socketStatus, setSocketStatus] = useState<SocketStatus>("connecting");

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const dayRef = useRef("");

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
        setStatusMessage("Connected. Tracking live sales.");
      };

      ws.onmessage = (event) => {
        const incoming = parseMessage(String(event.data));
        if (!incoming) {
          return;
        }

        if (incoming.type === "SALES_SNAPSHOT") {
          dayRef.current = incoming.payload.day;
          setDay(incoming.payload.day);
          setSales(incoming.payload.sales);
          return;
        }

        if (incoming.type === "NEW_SALE") {
          setSales((current) => {
            if (dayRef.current && toDayKey(incoming.payload.createdAt) !== dayRef.current) {
              return current;
            }
            return [incoming.payload, ...current];
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

  const waiterSummary = useMemo(() => {
    const map = new Map<string, WaiterSummary>();
    for (const sale of sales) {
      const key = sale.waiterName.trim() || "Unknown Waiter";
      const current = map.get(key) || { waiterName: key, orders: 0, total: 0 };
      current.orders += 1;
      current.total += sale.total;
      map.set(key, current);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [sales]);

  const grandTotal = useMemo(
    () => waiterSummary.reduce((sum, row) => sum + row.total, 0),
    [waiterSummary],
  );

  const totalOrders = sales.length;

  return (
    <main
      className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50 px-4 py-6 text-slate-900 md:px-6"
      style={{ fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif' }}
    >
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Admin Dashboard</p>
            <h1 className="text-2xl font-bold">Daily Waiter Totals</h1>
            <p className="text-sm text-slate-500">Day: {day || "loading..."}</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
              socketStatus === "connected"
                ? "bg-green-100 text-green-700"
                : socketStatus === "connecting"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-red-100 text-red-700"
            }`}
          >
             {socketStatus}
          </span>
        </header>

        {statusMessage ? (
          <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            {statusMessage}
          </p>
        ) : null}

        <section className="grid gap-3 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-md">
            <p className="text-sm font-semibold text-slate-500">Total Sales</p>
            <p className="mt-1 text-3xl font-extrabold text-[#2E7D32]">{money(grandTotal)}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-md">
            <p className="text-sm font-semibold text-slate-500">Order Count</p>
            <p className="mt-1 text-3xl font-extrabold text-[#4F7CFF]">{totalOrders}</p>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
          <h2 className="text-lg font-bold text-slate-800">By Waiter</h2>
          {waiterSummary.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No sales recorded yet for this day.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="px-3 py-2 font-semibold">Waiter</th>
                    <th className="px-3 py-2 font-semibold">Orders</th>
                    <th className="px-3 py-2 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {waiterSummary.map((row) => (
                    <tr key={row.waiterName} className="border-b border-slate-100">
                      <td className="px-3 py-2 font-semibold text-slate-700">{row.waiterName}</td>
                      <td className="px-3 py-2">{row.orders}</td>
                      <td className="px-3 py-2 font-bold text-[#2E7D32]">{money(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
