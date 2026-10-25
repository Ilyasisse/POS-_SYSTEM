"use client";

import {
  CustomerLanguageSelect,
  useCustomerTranslations,
} from "@/components/customer/i18n/CustomerLanguageProvider";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CUSTOMER_ORDER_STAGES,
  type CustomerOrderStage,
} from "@/lib/customer/customer-order-progress";
import { CheckCircle2, CircleAlert, Copy, LoaderCircle, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { clearCustomerOrderDraft } from "@/lib/customer/customer-order-draft";
import { androidDialerHref, customerUssdCode, isAndroidDevice } from "@/lib/payments/customer-ussd";

type Checkout = {
  id: string;
  amount: number;
  payerPhone: string;
  status: "PENDING" | "REVIEW" | "PAYMENT_RECEIVED" | "PAID" | "EXPIRED" | "NEEDS_HELP";
  expiresAt: string;
  orderNumber: number | null;
  paymentReceived: boolean;
  orderType: "DINE_IN" | "TAKEOUT";
  tableName: string | null;
  stage: CustomerOrderStage;
};

export default function CustomerCheckoutPageClient({ checkoutId }: { checkoutId: string }) {
  const t = useCustomerTranslations();
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
      const response = await fetch(`/api/customer/checkouts/${encodeURIComponent(checkoutId)}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as {
        checkout?: Checkout;
        error?: string;
      };
      if (!response.ok || !data.checkout) {
        throw new Error(data.error || t("checkPaymentError"));
      }
      if (sequence !== requestSequence.current) return;
      setCheckout(data.checkout);
      setError("");
    } catch (cause) {
      if (sequence !== requestSequence.current) return;
      setError(cause instanceof Error ? cause.message : t("checkPaymentError"));
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [checkoutId, t]);

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

  const code = useMemo(() => (checkout ? customerUssdCode(checkout.amount) : ""), [checkout]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      toast({ tone: "success", description: t("codeCopied") });
    } catch {
      toast({
        tone: "error",
        description: t("copyError"),
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
        throw new Error(data.error || t("reviewError"));
      }
      toast({
        tone: "info",
        description: t("reviewRequested"),
      });
      await refresh();
    } catch (cause) {
      toast({
        tone: "error",
        description: cause instanceof Error ? cause.message : t("reviewError"),
      });
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center p-6">
        <LoaderCircle className="size-8 animate-spin" aria-label={t("loadingCheckout")} />
      </main>
    );
  }
  if (!checkout) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <p role="alert">{error || t("checkoutNotFound")}</p>
        <Link prefetch={false} href="/customer">
          {t("returnMenu")}
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
        ? t("checkingPayment")
        : t("waitingPayment")
      : checkout.status === "REVIEW"
        ? t("staffReview")
        : checkout.status === "PAYMENT_RECEIVED"
          ? t("confirmingOrder")
          : checkout.status === "PAID"
            ? checkout.stage === "DELIVERED"
              ? t("orderDelivered")
              : t("paidOrder", {
                  number: checkout.orderNumber ?? "",
                  stage: t(`stage${checkout.stage}`),
                })
            : checkout.status === "NEEDS_HELP"
              ? t("paymentNeedsHelp")
              : t("paymentExpired");

  return (
    <main className="bg-background text-foreground min-h-screen px-4 py-8 sm:py-14">
      <div className="border-border bg-card mx-auto max-w-xl space-y-6 rounded-3xl border p-5 shadow-xl sm:p-8">
        <div>
          <div className="mb-4 flex justify-end">
            <CustomerLanguageSelect />
          </div>
          <p className="text-xs font-bold tracking-[0.22em] text-amber-800 uppercase dark:text-amber-300">
            {t("mobileCheckout")}
          </p>
          <h1 className="mt-2 text-3xl font-bold">
            {checkout.status === "PAID" ? t("yourOrder") : t("payOrder")}
          </h1>
          <p className="mt-2 font-semibold">
            {checkout.orderType === "DINE_IN"
              ? t("dineInTable", { table: checkout.tableName ?? t("yourTable") })
              : t("toGoOrder")}
          </p>
          <p className="text-muted-foreground mt-2 text-sm">
            {t("payerInstruction", { phone: checkout.payerPhone })}
          </p>
        </div>
        {checkout.status === "PENDING" || checkout.status === "REVIEW" ? (
          <section className="space-y-4 rounded-2xl bg-amber-50 p-5 dark:bg-amber-950/40">
            <p className="text-muted-foreground text-sm font-semibold">{t("amountDue")}</p>
            <p className="text-4xl font-bold">${checkout.amount.toFixed(2)}</p>
            <p className="text-foreground text-sm">{t("codeInstruction")}</p>
            <div
              className="bg-card rounded-xl border border-amber-300 px-4 py-3 font-mono text-lg font-semibold break-all select-all dark:border-amber-800"
              aria-label={t("paymentCode")}
            >
              {code}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button type="button" onClick={copyCode}>
                <Copy className="mr-2 size-4" />
                {t("copyCode")}
              </Button>
              {android ? (
                <Button asChild variant="outline">
                  <a href={androidDialerHref(code)}>
                    <PhoneCall className="mr-2 size-4" />
                    {t("payNow")}
                  </a>
                </Button>
              ) : null}
            </div>
            {android ? <p className="text-muted-foreground text-xs">{t("dialerHelp")}</p> : null}
          </section>
        ) : null}
        <div className="border-border rounded-2xl border p-5" role="status" aria-live="polite">
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
                <p className="text-muted-foreground mt-1 text-sm">{t("paymentPageHelp")}</p>
              ) : null}
            </div>
          </div>
        </div>
        {checkout.status === "PAID" ? (
          <section aria-label={t("orderProgress")} className="space-y-3">
            <div
              role="progressbar"
              aria-label={t("orderProgress")}
              aria-valuemin={0}
              aria-valuemax={5}
              aria-valuenow={Math.max(
                0,
                CUSTOMER_ORDER_STAGES.findIndex((stage) => stage.key === checkout.stage),
              )}
              aria-valuetext={t(`stage${checkout.stage}`)}
              className="h-3 overflow-hidden rounded-full bg-stone-200"
            >
              <div
                className="h-full bg-emerald-600 transition-[width]"
                style={{
                  width: `${
                    Math.max(
                      0,
                      CUSTOMER_ORDER_STAGES.findIndex((stage) => stage.key === checkout.stage),
                    ) * 20
                  }%`,
                }}
              />
            </div>
            <ol className="grid grid-cols-2 gap-2 text-sm">
              {CUSTOMER_ORDER_STAGES.map((stage, index) => (
                <li
                  key={stage.key}
                  aria-current={stage.key === checkout.stage ? "step" : undefined}
                  className={
                    index <=
                    CUSTOMER_ORDER_STAGES.findIndex((value) => value.key === checkout.stage)
                      ? "font-semibold text-emerald-800"
                      : "text-stone-500"
                  }
                >
                  {index + 1}. {t(`stage${stage.key}`)}
                </li>
              ))}
            </ol>
            {checkout.stage !== "DELIVERED" ? (
              <p className="text-sm text-stone-600">{t("progressHelp")}</p>
            ) : null}
          </section>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
            {error}{" "}
            <Button type="button" variant="link" onClick={() => void refresh()}>
              {t("tryAgain")}
            </Button>
          </p>
        ) : null}
        {checkout.status === "PENDING" ||
        checkout.status === "REVIEW" ||
        checkout.status === "EXPIRED" ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => void requestReview()}
          >
            {t("paidCheckAgain")}
          </Button>
        ) : null}
        {checkout.stage === "DELIVERED" ? (
          <Button asChild className="w-full">
            <Link prefetch={false} href="/customer">
              {t("backMenu")}
            </Link>
          </Button>
        ) : null}
        {checkout.status === "EXPIRED" || checkout.status === "NEEDS_HELP" ? (
          <p className="text-muted-foreground text-sm">
            {t("showCashier")} <span className="font-mono">{checkout.id}</span>
          </p>
        ) : null}
      </div>
    </main>
  );
}
