"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type Checkout = {
  id: string;
  customerName: string;
  payerPhone: string;
  amount: number;
  status: string;
  receiptId: string | null;
  createdAt: string;
  expiresAt: string;
};
type Receipt = {
  id: string;
  amount: number;
  providerReference: string | null;
  counterpartyLabel: string | null;
  counterpartyIdentifiers: unknown;
  rawMessage: string;
  transactionAt: string | null;
};

export default function CustomerCheckoutReview() {
  const { toast } = useToast();
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [checkoutId, setCheckoutId] = useState("");
  const [receiptId, setReceiptId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/cashier/customer-checkouts", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Could not load customer payments.");
      const data = (await response.json()) as {
        checkouts: Checkout[];
        receipts: Receipt[];
      };
      setCheckouts(data.checkouts);
      setReceipts(data.receipts);
    } catch (error) {
      toast({
        tone: "error",
        description:
          error instanceof Error
            ? error.message
            : "Could not load customer payments.",
      });
    }
  }, [toast]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 5000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [refresh]);

  const selectedCheckout = checkouts.find(
    (checkout) => checkout.id === checkoutId,
  );
  const selectedReceipt = receipts.find((receipt) => receipt.id === receiptId);
  const amountMatches = Boolean(
    selectedCheckout &&
    selectedReceipt &&
    Math.round(selectedCheckout.amount * 100) ===
      Math.round(selectedReceipt.amount * 100),
  );

  async function submit() {
    if (!selectedCheckout || !selectedReceipt || !confirmed || !amountMatches)
      return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/cashier/customer-checkouts/${encodeURIComponent(selectedCheckout.id)}/assign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ receiptId: selectedReceipt.id }),
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(data.error || "Could not assign receipt.");
      toast({
        tone: "success",
        description: "Receipt assigned to customer checkout.",
      });
      setCheckoutId("");
      setReceiptId("");
      setConfirmed(false);
      await refresh();
    } catch (error) {
      toast({
        tone: "error",
        description:
          error instanceof Error ? error.message : "Could not assign receipt.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function retry(checkout: Checkout) {
    setBusy(true);
    try {
      const response = await fetch(
        `/api/cashier/customer-checkouts/${encodeURIComponent(checkout.id)}/retry`,
        { method: "POST" },
      );
      const data = (await response.json()) as { ok?: boolean };
      if (!response.ok || !data.ok)
        throw new Error(
          "Order still needs staff help. Check payment cashier configuration and logs.",
        );
      toast({
        tone: "success",
        description: "Paid order sent to the kitchen.",
      });
      await refresh();
    } catch (error) {
      toast({
        tone: "error",
        description:
          error instanceof Error ? error.message : "Could not finish order.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Customer payment review</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Compare the SMS reference, payer, amount, and time before assigning
            a receipt.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link prefetch={false} href="/cashier">
            Back to cashier
          </Link>
        </Button>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Customer checkouts</h2>
          {checkouts.length === 0 ? (
            <p className="rounded-xl border p-4">
              No pending customer checkouts.
            </p>
          ) : null}
          {checkouts.map((checkout) => (
            <div key={checkout.id} className="rounded-xl border bg-card p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="radio"
                  name="checkout"
                  checked={checkoutId === checkout.id}
                  onChange={() => {
                    setCheckoutId(checkout.id);
                    setConfirmed(false);
                  }}
                  disabled={Boolean(checkout.receiptId)}
                />
                <span>
                  <strong>{checkout.customerName}</strong> · $
                  {checkout.amount.toFixed(2)}
                  <span className="block text-sm">
                    {checkout.payerPhone} ·{" "}
                    {checkout.status.replaceAll("_", " ")}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {new Date(checkout.createdAt).toLocaleString()} ·{" "}
                    {checkout.id}
                  </span>
                </span>
              </label>
              {checkout.status === "NEEDS_HELP" ? (
                <Button
                  type="button"
                  className="mt-3"
                  disabled={busy}
                  onClick={() => void retry(checkout)}
                >
                  Retry paid order
                </Button>
              ) : null}
            </div>
          ))}
        </section>
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">
            Unassigned incoming receipts
          </h2>
          {receipts.length === 0 ? (
            <p className="rounded-xl border p-4">
              No unassigned incoming receipts. Check the manager review inbox
              for malformed messages.
            </p>
          ) : null}
          {receipts.map((receipt) => (
            <label
              key={receipt.id}
              className="flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-4"
            >
              <input
                type="radio"
                name="receipt"
                checked={receiptId === receipt.id}
                onChange={() => {
                  setReceiptId(receipt.id);
                  setConfirmed(false);
                }}
              />
              <span className="min-w-0">
                <strong>Tix {receipt.providerReference ?? "unknown"}</strong> ·
                ${receipt.amount.toFixed(2)}
                <span className="block text-sm">
                  {receipt.counterpartyLabel ?? "Payer unknown"}
                </span>
                <span className="block text-xs text-muted-foreground">
                  Numbers:{" "}
                  {Array.isArray(receipt.counterpartyIdentifiers)
                    ? receipt.counterpartyIdentifiers.join(", ")
                    : "none"}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {receipt.transactionAt
                    ? new Date(receipt.transactionAt).toLocaleString()
                    : "Time unknown"}
                </span>
                <span className="mt-2 block break-words text-xs">
                  {receipt.rawMessage}
                </span>
              </span>
            </label>
          ))}
        </section>
      </div>
      {selectedCheckout && selectedReceipt ? (
        <section className="rounded-xl border bg-card p-4">
          <p className="font-semibold">
            {amountMatches
              ? "Amounts match"
              : "Amounts differ — choose another receipt"}
          </p>
          <label className="mt-3 flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>
              I checked the SMS reference, payer, amount, and time for this
              customer checkout.
            </span>
          </label>
          <Button
            type="button"
            className="mt-4"
            disabled={!confirmed || !amountMatches || busy}
            onClick={() => void submit()}
          >
            Assign receipt and finish paid order
          </Button>
        </section>
      ) : null}
    </main>
  );
}
