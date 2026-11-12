"use client";
import { useState } from "react";
import { useClientResource } from "@/hooks/useClientResource";
import Link from "next/link";
type Notification = {
  id: string;
  newValue: { orderNumber?: number; destination?: string };
};
async function loadNotifications(signal: AbortSignal) {
  const response = await fetch("/api/staff/customer-order-notifications", {
    cache: "no-store",
    signal,
  });
  if (!response.ok)
    throw new Error("Customer order notifications are unavailable. Check the order board.");
  return response.json() as Promise<{
    notifications: Notification[];
    paymentReview?: { checkouts: number; receipts: number };
  }>;
}

export default function CustomerOrderNotifications({
  waiter,
  manager = false,
}: {
  waiter: boolean;
  manager?: boolean;
}) {
  const [items, setItems] = useState<Notification[]>([]);
  const [paymentReview, setPaymentReview] = useState({
    checkouts: 0,
    receipts: 0,
  });
  const [error, setError] = useState("");
  useClientResource({
    load: loadNotifications,
    intervalMs: 5_000,
    onlyWhenVisible: true,
    onData(data) {
      setItems(data.notifications);
      setPaymentReview(data.paymentReview ?? { checkouts: 0, receipts: 0 });
      setError("");
    },
    onError(cause) {
      setError(cause instanceof Error ? cause.message : "Could not load order notifications.");
    },
  });
  if (
    !items.length &&
    !error &&
    !paymentReview.checkouts &&
    !paymentReview.receipts
  )
    return null;
  return (
    <aside
      aria-label="Customer order notifications"
      aria-live="polite"
      className="border-b bg-amber-50 p-3 text-sm text-stone-900"
    >
      {error ? <p role="alert">{error}</p> : null}
      {manager &&
      (paymentReview.checkouts > 0 || paymentReview.receipts > 0) ? (
        <p>
          Payment review needed: {paymentReview.checkouts} customer checkouts ·{" "}
          {paymentReview.receipts} unassigned or unparsed receipts.{" "}
          <Link
            prefetch={false}
            href="/admin/payment-review"
            className="underline"
          >
            Review payments
          </Link>
        </p>
      ) : null}
      {items.map((item) => (
        <p key={item.id}>
          New paid customer order #{item.newValue.orderNumber} ·{" "}
          {item.newValue.destination}.{" "}
          <Link
            prefetch={false}
            href={waiter ? "/waiter" : "/cashier/customer-checkouts"}
            className="underline"
          >
            View orders
          </Link>
        </p>
      ))}
    </aside>
  );
}
