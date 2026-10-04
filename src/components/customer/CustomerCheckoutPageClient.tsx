"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CUSTOMER_ORDER_STAGES, type CustomerOrderStage } from "@/lib/customer/customer-order-progress";
import {
  CheckCircle2,
  CircleAlert,
  Copy,
  LoaderCircle,
  PhoneCall,
} from "lucide-react";
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
  status:
    | "PENDING"
    | "REVIEW"
    | "PAYMENT_RECEIVED"
    | "PAID"
    | "EXPIRED"
    | "NEEDS_HELP";
  expiresAt: string;
  orderNumber: number | null;
  paymentReceived: boolean;
  orderType: "DINE_IN" | "TAKEOUT";
  tableName: string | null;
  stage: CustomerOrderStage;
};

export default function CustomerCheckoutPageClient({
  checkoutId,
}: {
  checkoutId: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [android, setAndroid] = useState(false);
  const [tick, setTick] = useState(0);
  const requestSequence = useRef(0);

  const refresh = useCallback(async () => {
    const sequence = ++requestSequence.current;
    try {
      const response = await fetch(
        `/api/customer/checkouts/${encodeURIComponent(checkoutId)}`,
        {
          cache: "no-store",
        },
      );
      const data = (await response.json()) as {
        checkout?: Checkout;
        error?: string;
      };
      if (!response.ok || !data.checkout) {
        throw new Error(data.error || "Could not check payment status.");
      }
      if (sequence !== requestSequence.current) return;
      setCheckout(data.checkout);
      setError("");
    } catch (cause) {
      if (sequence !== requestSequence.current) return;
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not check payment status.",
      );
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
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
      requestSequence.current++;
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [refresh]);

  useEffect(() => {
    if (checkout?.status === "PAID") clearCustomerOrderDraft();
  }, [checkout?.status]);

  useEffect(() => {
    if (checkout?.stage !== "DELIVERED") return;
    const timeout = window.setTimeout(() => router.replace("/customer"), 5000);
    return () => window.clearTimeout(timeout);
  }, [checkout?.stage, router]);

  const code = useMemo(
    () => (checkout ? customerUssdCode(checkout.amount) : ""),
    [checkout],
  );

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      toast({ tone: "success", description: "Payment code copied." });
    } catch {
      toast({
        tone: "error",
        description:
          "Copy failed. Select the code on this page and copy it manually.",
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
      toast({
        tone: "info",
        description: "We will keep checking and staff can review your payment.",
      });
      await refresh();
    } catch (cause) {
      toast({
        tone: "error",
        description:
          cause instanceof Error ? cause.message : "Could not request review.",
      });
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center p-6">
        <LoaderCircle
          className="size-8 animate-spin"
          aria-label="Loading checkout"
        />
      </main>
    );
  }
  if (!checkout) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <p role="alert">{error || "Checkout not found."}</p>
        <Link prefetch={false} href="/customer">
          Return to menu
        </Link>
      </main>
    );
  }

  const waiting =
    checkout.status === "PENDING" ||
    checkout.status === "REVIEW" ||
    checkout.status === "PAYMENT_RECEIVED";
  const statusText =
    checkout.status === "PENDING"
      ? tick % 2
        ? "Checking for your mobile money payment…"
        : "Waiting for the payment message…"
      : checkout.status === "REVIEW"
        ? "Staff review requested. Do not send the money again while we check."
        : checkout.status === "PAYMENT_RECEIVED"
          ? "Payment received. Confirming your order…"
          : checkout.status === "PAID"
            ? checkout.stage === "DELIVERED" ? "Thank you! Your order has been delivered. Returning to the menu…" : `Paid. Order #${checkout.orderNumber}: ${CUSTOMER_ORDER_STAGES.find(stage => stage.key === checkout.stage)?.label ?? "Kitchen received"}.`
            : checkout.status === "NEEDS_HELP"
              ? "Payment received. Staff need to finish your order."
              : "This payment window expired. If you paid, ask staff to review your receipt.";

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:py-14">
      <div className="mx-auto max-w-xl space-y-6 rounded-3xl border border-border bg-card p-5 shadow-xl sm:p-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-800 dark:text-amber-300">
            Mobile money checkout
          </p>
          <h1 className="mt-2 text-3xl font-bold">{checkout.status === "PAID" ? "Your order" : "Pay for your order"}</h1>
          <p className="mt-2 font-semibold">{checkout.orderType === "DINE_IN" ? `Dine in · ${checkout.tableName ?? "Your table"}` : "To-go order"}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Use the phone number {checkout.payerPhone} to send the full amount.
          </p>
        </div>
        {checkout.status === "PENDING" || checkout.status === "REVIEW" ? (
          <section className="space-y-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 p-5">
            <p className="text-sm font-semibold text-muted-foreground">
              Amount due
            </p>
            <p className="text-4xl font-bold">${checkout.amount.toFixed(2)}</p>
            <p className="text-sm text-foreground">
              Copy this code into your phone app. Enter your PIN there to
              authorize payment.
            </p>
            <div
              className="select-all break-all rounded-xl border border-amber-300 dark:border-amber-800 bg-card px-4 py-3 font-mono text-lg font-semibold"
              aria-label="Mobile money payment code"
            >
              {code}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button type="button" onClick={copyCode}>
                <Copy className="mr-2 size-4" />
                Copy code
              </Button>
              {android ? (
                <Button asChild variant="outline">
                  <a href={androidDialerHref(code)}>
                    <PhoneCall className="mr-2 size-4" />
                    Pay Now
                  </a>
                </Button>
              ) : null}
            </div>
            {android ? (
              <p className="text-xs text-muted-foreground">
                Check the dialer code before calling. If it does not prefill,
                use Copy code.
              </p>
            ) : null}
          </section>
        ) : null}
        <div
          className="rounded-2xl border border-border p-5"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            {waiting ? (
              <LoaderCircle className="mt-0.5 size-6 shrink-0 animate-spin text-amber-700 dark:text-amber-300" />
            ) : checkout.status === "PAID" ? (
              <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-700 dark:text-emerald-300" />
            ) : (
              <CircleAlert className="mt-0.5 size-6 shrink-0 text-amber-700 dark:text-amber-300" />
            )}
            <div>
              <p className="font-semibold">{statusText}</p>
              {waiting ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Keep this page open or return after making the payment. We
                  check again when you come back.
                </p>
              ) : null}
            </div>
          </div>
        </div>
        {checkout.status === "PAID" ? <section aria-label="Order progress" className="space-y-3">
          <div role="progressbar" aria-label="Order progress" aria-valuemin={0} aria-valuemax={5}
            aria-valuenow={Math.max(0, CUSTOMER_ORDER_STAGES.findIndex(stage => stage.key === checkout.stage))}
            aria-valuetext={CUSTOMER_ORDER_STAGES.find(stage => stage.key === checkout.stage)?.label}
            className="h-3 overflow-hidden rounded-full bg-stone-200">
            <div className="h-full bg-emerald-600 transition-[width]" style={{ width: `${Math.max(0, CUSTOMER_ORDER_STAGES.findIndex(stage => stage.key === checkout.stage)) * 20}%` }} />
          </div>
          <ol className="grid grid-cols-2 gap-2 text-sm">
            {CUSTOMER_ORDER_STAGES.map((stage, index) => <li key={stage.key}
              aria-current={stage.key === checkout.stage ? "step" : undefined}
              className={index <= CUSTOMER_ORDER_STAGES.findIndex(value => value.key === checkout.stage) ? "font-semibold text-emerald-800" : "text-stone-500"}>
              {index + 1}. {stage.label}
            </li>)}
          </ol>
          {checkout.stage !== "DELIVERED" ? <p className="text-sm text-stone-600">Keep this page open to follow your order. It updates automatically and checks again when you return.</p> : null}
        </section> : null}
        {error ? (
          <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
            {error}{" "}
            <Button type="button" variant="link" onClick={() => void refresh()}>
              Try again
            </Button>
          </p>
        ) : null}
        {checkout.status === "PENDING" || checkout.status === "REVIEW" || checkout.status === "EXPIRED" ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => void requestReview()}
          >
            I paid — check again
          </Button>
        ) : null}
        {checkout.stage === "DELIVERED" ? (
          <Button asChild className="w-full">
            <Link prefetch={false} href="/customer">
              Back to menu
            </Link>
          </Button>
        ) : null}
        {checkout.status === "EXPIRED" || checkout.status === "NEEDS_HELP" ? (
          <p className="text-sm text-muted-foreground">
            Show this checkout to the cashier:{" "}
            <span className="font-mono">{checkout.id}</span>
          </p>
        ) : null}
      </div>
    </main>
  );
}
