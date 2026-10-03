"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
type Notification = { id: string; newValue: { orderNumber?: number; destination?: string } };
export default function CustomerOrderNotifications({ waiter }: { waiter: boolean }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function refresh() {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/staff/customer-order-notifications", { cache: "no-store" });
        if (!response.ok) throw new Error("Customer order notifications are unavailable. Check the order board.");
        const data = await response.json() as { notifications: Notification[] };
        if (active) { setItems(data.notifications); setError(""); }
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "Could not load order notifications."); }
    }
    void refresh();
    const interval = window.setInterval(() => void refresh(), 5000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);
  if (!items.length && !error) return null;
  return <aside aria-label="Customer order notifications" aria-live="polite" className="border-b bg-amber-50 p-3 text-sm text-stone-900">
    {error ? <p role="alert">{error}</p> : null}
    {items.map(item => <p key={item.id}>New paid customer order #{item.newValue.orderNumber} · {item.newValue.destination}.{" "}
      <Link prefetch={false} href={waiter ? "/waiter" : "/cashier/customer-checkouts"} className="underline">View orders</Link></p>)}
  </aside>;
}
