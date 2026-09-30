"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { normalizeSomaliPhone } from "@/lib/payments/customer-ussd";
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

export default function CustomerCheckoutReview({ admin = false }: { admin?: boolean }) {
  const { toast } = useToast();
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [checkoutId, setCheckoutId] = useState("");
  const [receiptId, setReceiptId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [checkoutPage, setCheckoutPage] = useState(0);
  const [receiptPage, setReceiptPage] = useState(0);
  const [hasMoreCheckouts, setHasMoreCheckouts] = useState(false);
  const [hasMoreReceipts, setHasMoreReceipts] = useState(false);
  const [checkedAt, setCheckedAt] = useState(0);
  const [reason, setReason] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/cashier/customer-checkouts?checkoutPage=${checkoutPage}&receiptPage=${receiptPage}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Could not load customer payments.");
      const data = (await response.json()) as {
        hasMoreCheckouts: boolean;
        hasMoreReceipts: boolean;
        canManage: boolean;
        checkouts: Checkout[];
        receipts: Receipt[];
      };
      setCheckedAt(Date.now());
      setCanManage(data.canManage);
      setHasMoreCheckouts(data.hasMoreCheckouts);
      setHasMoreReceipts(data.hasMoreReceipts);
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
  }, [toast, checkoutPage, receiptPage]);

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
    if (!selectedCheckout || !selectedReceipt || !confirmed || !amountMatches || reason.trim().length < 5)
      return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/cashier/customer-checkouts/${encodeURIComponent(selectedCheckout.id)}/assign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ receiptId: selectedReceipt.id, reason }),
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
          <Link prefetch={false} href={admin ? "/admin" : "/cashier"}>Back to workspace</Link>
        </Button>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Customer checkouts</h2>
          <div className="flex items-center gap-2 text-sm">
            <Button variant="outline" disabled={checkoutPage === 0 || busy} onClick={() => { setCheckoutId(""); setConfirmed(false); setCheckoutPage(page => page - 1); }}>Previous</Button>
            <span>Page {checkoutPage + 1}</span>
            <Button variant="outline" disabled={!hasMoreCheckouts || busy} onClick={() => { setCheckoutId(""); setConfirmed(false); setCheckoutPage(page => page + 1); }}>Next</Button>
          </div>
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
          <div className="flex items-center gap-2 text-sm">
            <Button variant="outline" disabled={receiptPage === 0 || busy} onClick={() => { setReceiptId(""); setConfirmed(false); setReceiptPage(page => page - 1); }}>Previous</Button>
            <span>Page {receiptPage + 1}</span>
            <Button variant="outline" disabled={!hasMoreReceipts || busy} onClick={() => { setReceiptId(""); setConfirmed(false); setReceiptPage(page => page + 1); }}>Next</Button>
          </div>
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
          <p className="mt-2 text-sm">
            Phone: {Array.isArray(selectedReceipt.counterpartyIdentifiers) && selectedReceipt.counterpartyIdentifiers.some(value => typeof value === "string" && normalizeSomaliPhone(value) === selectedCheckout.payerPhone) ? "matches" : "differs — manager review required"}.
            {" "}Window: {selectedReceipt.transactionAt && new Date(selectedReceipt.transactionAt) <= new Date(selectedCheckout.expiresAt) && checkedAt <= new Date(selectedCheckout.expiresAt).getTime() ? "within 15 minutes" : "expired — manager review required"}.
          </p>
          <label className="mt-3 block text-sm">Review reason (required)
            <input value={reason} onChange={event => setReason(event.target.value)} className="mt-1 block w-full rounded-lg border bg-background p-3" placeholder="Explain the evidence used to verify this payment" />
          </label>
          {canManage ? <p className="mt-2 text-xs text-muted-foreground">Admin/manager review can resolve phone or time exceptions. Amount and receipt uniqueness are always enforced.</p> : null}
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
            disabled={!confirmed || !amountMatches || reason.trim().length < 5 || busy}
            onClick={() => void submit()}
          >
            Assign receipt and finish paid order
          </Button>
        </section>
      ) : null}
    </main>
  );
}
