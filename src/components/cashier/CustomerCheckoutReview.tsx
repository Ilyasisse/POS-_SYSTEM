"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { customerPaymentNameMatches, normalizeSomaliPhone } from "@/lib/payments/customer-ussd";
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
  const mutationRef = useRef(false);
  const requestVersion = useRef(0);
  const [loadError, setLoadError] = useState("");
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [checkoutId, setCheckoutId] = useState("");
  const [receiptId, setReceiptId] = useState("");
  const [confirmedFor, setConfirmedFor] = useState("");
  const [checkoutPage, setCheckoutPage] = useState(0);
  const [receiptPage, setReceiptPage] = useState(0);
  const [hasMoreCheckouts, setHasMoreCheckouts] = useState(false);
  const [hasMoreReceipts, setHasMoreReceipts] = useState(false);
  const [checkedAt, setCheckedAt] = useState(0);
  const [reason, setReason] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const response = await fetch(
        `/api/cashier/customer-checkouts?checkoutPage=${checkoutPage}&receiptPage=${receiptPage}`,
        {
          cache: "no-store",
        },
      );
      if (!response.ok) throw new Error("Could not load customer payments.");
      const data = (await response.json()) as {
        hasMoreCheckouts: boolean;
        hasMoreReceipts: boolean;
        canManage: boolean;
        checkouts: Checkout[];
        receipts: Receipt[];
      };
      if (version !== requestVersion.current) return;
      setLoadError("");
      setCheckedAt(Date.now());
      setCanManage(data.canManage);
      setHasMoreCheckouts(data.hasMoreCheckouts);
      setHasMoreReceipts(data.hasMoreReceipts);
      setCheckouts(data.checkouts);
      setReceipts(data.receipts);
    } catch (error) {
      if (version !== requestVersion.current) return;
      setLoadError(error instanceof Error ? error.message : "Could not load payments.");
      toast({
        tone: "error",
        description: error instanceof Error ? error.message : "Could not load customer payments.",
      });
    }
  }, [toast, checkoutPage, receiptPage]);

  const invalidateRequests = useCallback(() => {
    ++requestVersion.current;
  }, []);
  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && !mutationRef.current) void refresh();
    }, 5000);
    return () => {
      invalidateRequests();
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [refresh, invalidateRequests]);

  const selectedCheckout = checkouts.find((checkout) => checkout.id === checkoutId);
  const selectedReceipt = receipts.find((receipt) => receipt.id === receiptId);
  const amountMatches = Boolean(
    selectedCheckout &&
    selectedReceipt &&
    Math.round(selectedCheckout.amount * 100) === Math.round(selectedReceipt.amount * 100),
  );

  // Confirmation belongs to the exact details the staff member reviewed.
  const verificationKey = JSON.stringify([selectedCheckout, selectedReceipt]);
  const confirmed = confirmedFor === verificationKey;
  function setConfirmed(value: boolean) {
    setConfirmedFor(value ? verificationKey : "");
  }

  async function submit() {
    if (
      mutationRef.current ||
      Boolean(loadError) ||
      !selectedCheckout ||
      !selectedReceipt ||
      !confirmed ||
      !amountMatches ||
      reason.trim().length < 5
    )
      return;
    mutationRef.current = true;
    ++requestVersion.current;
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
      if (!response.ok) throw new Error(data.error || "Could not assign receipt.");
      toast({
        tone: "success",
        description: "Receipt assigned to customer checkout.",
      });
      setCheckoutId("");
      setReceiptId("");
      setConfirmed(false);
      setReason("");
      await refresh();
    } catch (error) {
      toast({
        tone: "error",
        description: error instanceof Error ? error.message : "Could not assign receipt.",
      });
    } finally {
      mutationRef.current = false;
      setBusy(false);
    }
  }

  async function retry(checkout: Checkout) {
    if (mutationRef.current) return;
    mutationRef.current = true;
    ++requestVersion.current;
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
        description: error instanceof Error ? error.message : "Could not finish order.",
      });
    } finally {
      mutationRef.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Customer payment review</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Compare the SMS reference, payer, amount, and time before assigning a receipt.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link prefetch={false} href={admin ? "/admin" : "/cashier"}>
            Back to workspace
          </Link>
        </Button>
      </div>
      {loadError ? (
        <div role="alert" className="border-destructive bg-card rounded-xl border p-4">
          <p>{loadError}</p>
          <Button variant="outline" className="mt-2 min-h-11" onClick={() => void refresh()}>
            Retry loading payments
          </Button>
        </div>
      ) : null}
      {!checkedAt && !loadError ? <p role="status">Loading customer payments…</p> : null}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
        <div className="space-y-5 lg:sticky lg:top-20 lg:col-start-2 lg:row-start-1">
          {selectedCheckout && selectedReceipt ? (
            <section
              id="payment-verification"
              tabIndex={-1}
              className="bg-card scroll-mt-24 rounded-2xl border p-4 shadow-sm lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto"
            >
              <h2 className="mb-3 text-lg font-bold">Verify selected payment</h2>
              <dl className="bg-muted/50 mb-4 grid gap-3 rounded-xl p-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground text-xs">Customer checkout</dt>
                  <dd className="mt-1 font-semibold break-words">
                    {selectedCheckout.customerName} · ${selectedCheckout.amount.toFixed(2)}
                  </dd>
                  <dd>{selectedCheckout.payerPhone}</dd>
                  <dd>
                    {new Date(selectedCheckout.createdAt).toLocaleString("en-GB", {
                      timeZone: "Africa/Mogadishu",
                    })}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Incoming receipt</dt>
                  <dd className="mt-1 font-semibold break-words">
                    {selectedReceipt.counterpartyLabel ?? "Payer unknown"} · $
                    {selectedReceipt.amount.toFixed(2)}
                  </dd>
                  <dd>Tix {selectedReceipt.providerReference ?? "unknown"}</dd>
                  <dd>
                    {selectedReceipt.transactionAt
                      ? new Date(selectedReceipt.transactionAt).toLocaleString("en-GB", {
                          timeZone: "Africa/Mogadishu",
                        })
                      : "Time unknown"}
                  </dd>
                </div>
              </dl>
              <details className="mb-3 rounded-xl border p-3">
                <summary className="min-h-11 cursor-pointer text-sm font-semibold">
                  View original SMS
                </summary>
                <p className="text-xs break-words whitespace-pre-wrap">
                  {selectedReceipt.rawMessage}
                </p>
              </details>
              <p className="font-semibold">
                {amountMatches
                  ? "Amounts match — verify payer and time below"
                  : "Amounts differ — choose another receipt"}
              </p>
              <p className="mt-2 text-sm">
                Name:{" "}
                {customerPaymentNameMatches(
                  selectedCheckout.customerName,
                  selectedReceipt.counterpartyLabel,
                )
                  ? "at least two words match"
                  : "fewer than two words match — manager review required"}
                . Phone:{" "}
                {Array.isArray(selectedReceipt.counterpartyIdentifiers) &&
                selectedReceipt.counterpartyIdentifiers.some(
                  (value) =>
                    typeof value === "string" &&
                    normalizeSomaliPhone(value) === selectedCheckout.payerPhone,
                )
                  ? "matches"
                  : "differs — manager review required"}
                . Window:{" "}
                {selectedReceipt.transactionAt &&
                new Date(selectedReceipt.transactionAt) <= new Date(selectedCheckout.expiresAt) &&
                checkedAt <= new Date(selectedCheckout.expiresAt).getTime()
                  ? "within 15 minutes"
                  : "expired — manager review required"}
                .
              </p>
              <label className="mt-3 block text-sm">
                Review reason (required)
                <input
                  disabled={busy}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="bg-background mt-1 block w-full rounded-lg border p-3"
                  placeholder="Explain the evidence used to verify this payment"
                />
              </label>
              {canManage ? (
                <p className="text-muted-foreground mt-2 text-xs">
                  Admin/manager review can resolve name, phone, or time exceptions. Amount and
                  receipt uniqueness are always enforced.
                </p>
              ) : null}
              <label className="mt-3 flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                <span>
                  I checked the SMS reference, payer, amount, and time for this customer checkout.
                </span>
              </label>
              <Button
                type="button"
                className="mt-4 h-auto min-h-11 w-full bg-emerald-700 whitespace-normal text-white hover:bg-emerald-800"
                disabled={
                  !confirmed ||
                  !amountMatches ||
                  reason.trim().length < 5 ||
                  busy ||
                  Boolean(loadError)
                }
                onClick={() => void submit()}
              >
                Assign receipt and finish paid order
              </Button>
            </section>
          ) : (
            <section className="bg-card rounded-2xl border border-dashed p-4">
              <h2 className="font-semibold">Review a payment</h2>
              <p className="text-muted-foreground mt-2 text-sm">
                Select a customer checkout and an incoming receipt. Their details and verification
                controls will appear here.
              </p>
            </section>
          )}
        </div>
        <div className="min-w-0 space-y-5 lg:col-start-1 lg:row-start-1">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Customer checkouts</h2>
            <div className="flex items-center gap-2 text-sm">
              <Button
                variant="outline"
                disabled={checkoutPage === 0 || busy}
                onClick={() => {
                  setCheckoutId("");
                  setConfirmed(false);
                  setReason("");
                  setCheckoutPage((page) => page - 1);
                }}
              >
                Previous
              </Button>
              <span>Page {checkoutPage + 1}</span>
              <Button
                variant="outline"
                disabled={!hasMoreCheckouts || busy}
                onClick={() => {
                  setCheckoutId("");
                  setConfirmed(false);
                  setReason("");
                  setCheckoutPage((page) => page + 1);
                }}
              >
                Next
              </Button>
            </div>
            {checkouts.length === 0 ? (
              <p className="rounded-xl border p-4">No pending customer checkouts.</p>
            ) : null}
            {checkouts.map((checkout) => (
              <div key={checkout.id} className="bg-card rounded-xl border p-4">
                <label className="flex min-h-11 cursor-pointer items-start gap-3 break-words">
                  <input
                    type="radio"
                    name="checkout"
                    checked={checkoutId === checkout.id}
                    onChange={() => {
                      setCheckoutId(checkout.id);
                      setConfirmed(false);
                      setReason("");
                    }}
                    disabled={Boolean(checkout.receiptId) || busy}
                  />
                  <span>
                    <strong>{checkout.customerName}</strong> · ${checkout.amount.toFixed(2)}
                    <span className="block text-sm">
                      {checkout.payerPhone} · {checkout.status.replaceAll("_", " ")}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {new Date(checkout.createdAt).toLocaleString()} · {checkout.id}
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
            <h2 className="text-lg font-semibold">Unassigned incoming receipts</h2>
            <div className="flex items-center gap-2 text-sm">
              <Button
                variant="outline"
                disabled={receiptPage === 0 || busy}
                onClick={() => {
                  setReceiptId("");
                  setConfirmed(false);
                  setReason("");
                  setReceiptPage((page) => page - 1);
                }}
              >
                Previous
              </Button>
              <span>Page {receiptPage + 1}</span>
              <Button
                variant="outline"
                disabled={!hasMoreReceipts || busy}
                onClick={() => {
                  setReceiptId("");
                  setConfirmed(false);
                  setReason("");
                  setReceiptPage((page) => page + 1);
                }}
              >
                Next
              </Button>
            </div>
            {receipts.length === 0 ? (
              <p className="rounded-xl border p-4">
                No unassigned incoming receipts. Check the manager review inbox for malformed
                messages.
              </p>
            ) : null}
            {receipts.map((receipt) => (
              <label
                key={receipt.id}
                className="bg-card flex cursor-pointer items-start gap-3 rounded-xl border p-4"
              >
                <input
                  type="radio"
                  name="receipt"
                  disabled={busy}
                  checked={receiptId === receipt.id}
                  onChange={() => {
                    setReceiptId(receipt.id);
                    setConfirmed(false);
                    setReason("");
                  }}
                />
                <span className="min-w-0">
                  <strong>Tix {receipt.providerReference ?? "unknown"}</strong> · $
                  {receipt.amount.toFixed(2)}
                  <span className="block text-sm">
                    {receipt.counterpartyLabel ?? "Payer unknown"}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    Numbers:{" "}
                    {Array.isArray(receipt.counterpartyIdentifiers)
                      ? receipt.counterpartyIdentifiers.join(", ")
                      : "none"}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {receipt.transactionAt
                      ? new Date(receipt.transactionAt).toLocaleString()
                      : "Time unknown"}
                  </span>
                </span>
              </label>
            ))}
          </section>
        </div>
      </div>
      {selectedCheckout && selectedReceipt ? (
        <div className="bg-card sticky bottom-0 z-20 rounded-xl border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
          <Button
            className="min-h-11 w-full"
            onClick={() => {
              const panel = document.getElementById("payment-verification");
              panel?.focus();
              panel?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            Review selected pair
          </Button>
        </div>
      ) : null}
    </main>
  );
}
