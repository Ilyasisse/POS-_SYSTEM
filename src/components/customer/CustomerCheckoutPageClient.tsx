"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, CircleAlert, Copy, LoaderCircle, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { clearCustomerOrderDraft } from "@/lib/customer/customer-order-draft";
import {
  androidDialerHref,
  customerUssdCode,
  isAndroidDevice,
} from "@/lib/payments/customer-ussd";

type Checkout = {
  id: string;
  amount: number;
  payerPhone: string;
  status: "PENDING" | "REVIEW" | "PAYMENT_RECEIVED" | "PAID" | "EXPIRED" | "NEEDS_HELP";
  expiresAt: string;
  orderNumber: number | null;
  paymentReceived: boolean;
};

export default function CustomerCheckoutPageClient({ checkoutId }: { checkoutId: string }) {
  const { toast } = useToast();
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [android, setAndroid] = useState(false);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/customer/checkouts/${encodeURIComponent(checkoutId)}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as { checkout?: Checkout; error?: string };
      if (!response.ok || !data.checkout) {
        throw new Error(data.error || "Could not check payment status.");
      }
      setCheckout(data.checkout);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not check payment status.");
    } finally {
      setLoading(false);
    }
  }, [checkoutId]);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      setAndroid(isAndroidDevice(navigator.userAgent));
      void refresh();
    }, 0);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setTick((current) => current + 1);
        void refresh();
      }
    }, 3000);
    const onReturn = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [refresh]);

  useEffect(() => {
    if (checkout?.status === "PAID") clearCustomerOrderDraft();
  }, [checkout?.status]);

  const code = useMemo(
    () => checkout ? customerUssdCode(checkout.amount) : "",
    [checkout],
  );

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      toast({ tone: "success", description: "Payment code copied." });
    } catch {
      toast({
        tone: "error",
        description: "Copy failed. Select the code on this page and copy it manually.",
      });
    }
  }

  async function requestReview() {
    try {
      const response = await fetch(
        `/api/customer/checkouts/${encodeURIComponent(checkoutId)}/review`,
        { method: "POST" },
      );
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Could not request review.");
      }
      toast({ tone: "info", description: "We will keep checking and staff can review your payment." });
      await refresh();
    } catch (cause) {
      toast({
        tone: "error",
        description: cause instanceof Error ? cause.message : "Could not request review.",
      });
    }
  }

  if (loading) {
    return <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center p-6"><LoaderCircle className="size-8 animate-spin" aria-label="Loading checkout" /></main>;
  }
  if (!checkout) {
    return <main className="mx-auto max-w-xl p-6"><p role="alert">{error || "Checkout not found."}</p><Link href="/customer">Return to menu</Link></main>;
  }

  const waiting = checkout.status === "PENDING" || checkout.status === "REVIEW" || checkout.status === "PAYMENT_RECEIVED";
  const statusText = checkout.status === "PENDING"
    ? tick % 2 ? "Checking for your mobile money payment…" : "Waiting for the payment message…"
    : checkout.status === "REVIEW"
      ? "Staff review requested. Do not send the money again while we check."
      : checkout.status === "PAYMENT_RECEIVED"
        ? "Payment received. Confirming your order…"
        : checkout.status === "PAID"
          ? `Paid. Order #${checkout.orderNumber} is with the kitchen.`
          : checkout.status === "NEEDS_HELP"
            ? "Payment received. Staff need to finish your order."
            : "This payment window expired. If you paid, ask staff to review your receipt.";

  return (
    <main className="min-h-screen bg-[#f6eee2] px-4 py-8 text-stone-900 sm:py-14">
      <div className="mx-auto max-w-xl space-y-6 rounded-3xl border border-stone-200 bg-white p-5 shadow-xl sm:p-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-800">Mobile money checkout</p>
          <h1 className="mt-2 text-3xl font-bold">Pay for your order</h1>
          <p className="mt-2 text-sm text-stone-600">Use the phone number {checkout.payerPhone} to send the full amount.</p>
        </div>
        {checkout.status === "PENDING" || checkout.status === "REVIEW" ? (
          <section className="space-y-4 rounded-2xl bg-amber-50 p-5">
            <p className="text-sm font-semibold text-stone-600">Amount due</p>
            <p className="text-4xl font-bold">${checkout.amount.toFixed(2)}</p>
            <p className="text-sm text-stone-700">Copy this code into your phone app. Enter your PIN there to authorize payment.</p>
            <div className="select-all break-all rounded-xl border border-amber-300 bg-white px-4 py-3 font-mono text-lg font-semibold" aria-label="Mobile money payment code">{code}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button type="button" onClick={copyCode}><Copy className="mr-2 size-4" />Copy code</Button>
              {android ? <Button asChild variant="outline"><a href={androidDialerHref(code)}><PhoneCall className="mr-2 size-4" />Open dialer</a></Button> : null}
            </div>
            {android ? <p className="text-xs text-stone-600">Check the dialer code before calling. If it does not prefill, use Copy code.</p> : null}
          </section>
        ) : null}
        <div className="rounded-2xl border border-stone-200 p-5" role="status" aria-live="polite">
          <div className="flex items-start gap-3">
            {waiting ? <LoaderCircle className="mt-0.5 size-6 shrink-0 animate-spin text-amber-700" />
              : checkout.status === "PAID" ? <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-700" />
                : <CircleAlert className="mt-0.5 size-6 shrink-0 text-amber-700" />}
            <div>
              <p className="font-semibold">{statusText}</p>
              {waiting ? <p className="mt-1 text-sm text-stone-600">Keep this page open or return after making the payment. We check again when you come back.</p> : null}
            </div>
          </div>
        </div>
        {error ? <p role="alert" className="text-sm text-rose-700">{error} <Button type="button" variant="link" onClick={() => void refresh()}>Try again</Button></p> : null}
        {(checkout.status === "PENDING" || checkout.status === "REVIEW") ? (
          <Button type="button" variant="outline" className="w-full" onClick={() => void requestReview()}>
            I paid — check again
          </Button>
        ) : null}
        {checkout.status === "PAID" ? <Button asChild className="w-full"><Link href="/customer">Back to menu</Link></Button> : null}
        {(checkout.status === "EXPIRED" || checkout.status === "NEEDS_HELP") ? (
          <p className="text-sm text-stone-600">Show this checkout to the cashier: <span className="font-mono">{checkout.id}</span></p>
        ) : null}
      </div>
    </main>
  );
}
