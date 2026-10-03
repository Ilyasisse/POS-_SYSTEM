"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
type Order = { id: string; orderNumber: number; customerName: string; destination: string; stage: string };
export default function CustomerFulfillmentBoard() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/staff/customer-fulfillment", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load paid customer orders.");
      const data = await response.json() as { orders: Order[] };
      setOrders(data.orders); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load orders."); }
  }, []);
  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 5000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [refresh]);
  async function update(order: Order, status: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/staff/customer-fulfillment", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.id, status }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not update order.");
      toast({ tone: "success", description: "Order status updated." }); await refresh();
    } catch (cause) { toast({ tone: "error", description: cause instanceof Error ? cause.message : "Could not update order." }); }
    finally { setBusy(false); }
  }
  return <section className="mx-auto max-w-6xl space-y-3 p-4 sm:p-8">
    <h2 className="text-xl font-bold">Paid customer orders</h2>
    {error ? <p role="alert">{error}</p> : null}
    {!orders.length ? <p>No customer orders waiting for delivery.</p> : null}
    {orders.map(order => <article key={order.id} className="rounded-xl border p-4">
      <p className="font-semibold">#{order.orderNumber} · {order.customerName} · {order.destination}</p>
      <p className="text-sm">{order.stage.replaceAll("_", " ")}</p>
      {order.stage === "READY" ? <Button className="mt-2" disabled={busy} onClick={() => void update(order, "claimed")}>Pick up order</Button> : null}
      {order.stage === "PICKED_UP" ? <Button className="mt-2" disabled={busy} onClick={() => void update(order, "delivered")}>Confirm delivered / handed over</Button> : null}
    </article>)}
  </section>;
}
