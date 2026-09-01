"use server";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import {
  formatCashierBusinessDayRange,
  getCashierBusinessDayRange,
} from "@/lib/cashier/cashier-business-day";
import { groupCashierOpenOrders } from "@/lib/cashier/table-checks";
import CashierLiveSync from "@/components/cashier/CashierLiveSync";
import CashierPaymentDialog from "@/components/cashier/CashierPaymentDialog";
import { ToastOnMount } from "@/components/ui/toast";

type CashierPageProps = {
  searchParams?: Promise<{
    paymentStatus?: string;
    orderStatus?: string;
  }>;
};

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

function formatDateTime(date: Date) {
  return timeFormatter.format(date);
}

function getPaymentStatusMessage(paymentStatus?: string) {
  switch (paymentStatus) {
    case "payment_saved":
      return {
        tone: "success" as const,
        message: "The table total has been paid and closed.",
      };
    case "invalid_payment":
      return {
        tone: "error" as const,
        message: "Select a valid table and payment method.",
      };
    case "order_not_open":
      return {
        tone: "error" as const,
        message: "This table no longer has open orders.",
      };
    case "payment_failed":
      return {
        tone: "error" as const,
        message: "The payment could not be saved.",
      };
    default:
      return null;
  }
}

export default async function CashierPage({ searchParams }: CashierPageProps) {
  const { start: businessDayStart, end: businessDayEnd } =
    getCashierBusinessDayRange();
  const businessDayLabel = formatCashierBusinessDayRange(
    businessDayStart,
    businessDayEnd,
  );

  // Resolve URL state with auth, but keep protected table reads after auth.
  const [currentUser, params] = await Promise.all([
    requirePermission(PERMISSIONS.ORDER_MANAGE),
    searchParams,
  ]);
  const paymentNotice = getPaymentStatusMessage(params?.paymentStatus);
  const orderNotice =
    params?.orderStatus === "sent"
      ? {
          tone: "success" as const,
          message: "The table order was sent to the kitchen.",
        }
      : null;
  const notice = paymentNotice ?? orderNotice;

  const tables = await prisma.table.findMany({
    where: {
      isActive: true,
      orders: {
        some: {
          status: "OPEN",
          type: "DINE_IN",
        },
      },
    },
    orderBy: { name: "asc" },
    include: {
      orders: {
        where: {
          status: "OPEN",
          type: "DINE_IN",
        },
        orderBy: { createdAt: "desc" },
        include: {
          cashier: { select: { fullName: true } },
          tableCheck: { select: { checkNumber: true } },
          orderItems: {
            select: {
              id: true,
              productName: true,
              qty: true,
            },
            orderBy: { createdAt: "asc" },
          },
          payments: {
            select: { amountPaid: true },
          },
        },
      },
    },
  });

  const openChecksByTable = new Map(
    tables.map((table) => [
      table.id,
      groupCashierOpenOrders(
        table.orders.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          tableCheckId: order.tableCheckId,
          tableCheckRound: order.tableCheckRound,
          tableCheck: order.tableCheck,
          total: Math.max(
            0,
            Number(order.total) -
              order.payments.reduce(
                (paid, payment) => paid + Number(payment.amountPaid),
                0,
              ),
          ),
          createdAt: order.createdAt,
          cashierName: order.cashier?.fullName ?? null,
          items: order.orderItems,
        })),
      ),
    ]),
  );

  return (
    <main className="min-h-screen bg-muted/35 p-4 text-foreground sm:p-6">
      <CashierLiveSync />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Cashier table settlement</h1>
          <p className="mt-2 text-lg text-foreground">
            Welcome {currentUser.fullName}
          </p>
          <p className="text-sm text-muted-foreground">
            Business day: {businessDayLabel}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/cashier/receipts"
            className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted"
          >
            Receipts
          </Link>
          <Link
            href="/cashier/order"
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            New table order
          </Link>
        </div>
      </div>

      {notice ? (
        <ToastOnMount
          tone={notice.tone}
          description={notice.message}
        />
      ) : null}

      {/*
      
      BRING BACK IF YOU WANT Occupied tables,Open order,Open order total

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Occupied tables</p>
          <h2 className="mt-2 text-2xl font-bold">{tables.length}</h2>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Open orders</p>
          <h2 className="mt-2 text-2xl font-bold">{openChecks.length}</h2>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Open order total</p>
          <h2 className="mt-2 text-2xl font-bold">
            {formatMoney(openOrderTotal)}
          </h2>
        </div>
      </div> */}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tables.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground shadow-sm md:col-span-2 xl:col-span-3">
            <h2 className="text-lg font-bold text-foreground">
              No occupied tables
            </h2>
            <p className="mt-2">
              Tables appear here only after an unpaid table order is sent. Use
              New table order to start service for an active table.
            </p>
          </div>
        ) : (
          tables.map((table) => {
            const tableChecks = openChecksByTable.get(table.id) ?? [];
            const tableTotal = tableChecks.reduce(
              (sum, check) => sum + check.total,
              0,
            );

            return (
              <article
                key={table.id}
                className="rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-3xl font-bold text-foreground">
                      {table.name}
                    </h2>
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase text-amber-700">
                    occupied
                  </span>
                </div>

                <div className="mb-4 rounded-xl bg-muted/50 px-3 py-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Open orders</span>
                    <span className="font-semibold">{tableChecks.length}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Table total</span>
                    <span className="font-semibold">
                      {formatMoney(tableTotal)}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {tableChecks.map((check) => (
                    <div
                      key={check.key}
                      className="rounded-xl border border-border px-3 py-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-semibold text-foreground">
                          Order #{check.orderNumber}
                        </p>
                        <p className="font-bold text-foreground">
                          {formatMoney(check.total)}
                        </p>
                      </div>

                      <div className="mt-2 space-y-2">
                        {check.rounds.map((round) => (
                          <div
                            key={round.id}
                            className="rounded-lg bg-muted/50 px-2.5 py-2"
                          >
                            <p className="text-xs font-semibold text-muted-foreground">
                              Round {round.tableCheckRound ?? 1} · {formatDateTime(round.createdAt)}
                              {round.cashierName ? ` by ${round.cashierName}` : ""}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {round.items
                                .map((item) => `${item.qty}x ${item.productName}`)
                                .join(", ")}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid gap-2">
                  <Link
                    href={`/cashier/order?tableId=${encodeURIComponent(table.id)}`}
                    className="block rounded-xl bg-emerald-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    Add order
                  </Link>
                  <CashierPaymentDialog
                    tableId={table.id}
                    tableName={table.name}
                    amountDue={tableTotal}
                  />
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
