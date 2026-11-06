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
import { canShowEqualBillSplit } from "@/lib/payments/equal-bill-split-flag";
import CashierLiveSync from "@/components/cashier/CashierLiveSync";
import CashierTableBoard from "@/components/cashier/CashierTableBoard";
import { ToastOnMount } from "@/components/ui/toast";

type CashierPageProps = {
  searchParams?: Promise<{
    paymentStatus?: string;
    orderStatus?: string;
  }>;
};

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Africa/Mogadishu",
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

function getOrderStatusMessage(orderStatus?: string) {
  if (orderStatus === "takeaway_paid") {
    return {
      tone: "success" as const,
      message: "The takeaway order was paid and sent to the kitchen.",
    };
  }
  if (orderStatus === "sent") {
    return {
      tone: "success" as const,
      message: "The table order was sent to the kitchen.",
    };
  }
  return null;
}

export default async function CashierPage({ searchParams }: CashierPageProps) {
  const { start: businessDayStart, end: businessDayEnd } = getCashierBusinessDayRange();
  const businessDayLabel = formatCashierBusinessDayRange(businessDayStart, businessDayEnd);

  // Resolve URL state with auth, but keep protected table reads after auth.
  const [currentUser, params] = await Promise.all([
    requirePermission(PERMISSIONS.ORDER_MANAGE),
    searchParams,
  ]);
  const showEqualSplit = await canShowEqualBillSplit(currentUser);
  const paymentNotice = getPaymentStatusMessage(params?.paymentStatus);
  const orderNotice = getOrderStatusMessage(params?.orderStatus);
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
              order.payments.reduce((paid, payment) => paid + Number(payment.amountPaid), 0),
          ),
          createdAt: order.createdAt,
          cashierName: order.cashier?.fullName ?? null,
          items: order.orderItems,
        })),
      ),
    ]),
  );

  return (
    <main className="bg-muted/35 text-foreground min-h-screen p-4 sm:p-6">
      <CashierLiveSync />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Open tables</h1>
          <p className="text-muted-foreground mt-1 text-sm">Welcome {currentUser.fullName}</p>
          <p className="text-muted-foreground text-sm">Business day: {businessDayLabel}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            prefetch={false}
            href="/cashier/receipts"
            className="border-border bg-card hover:bg-muted inline-flex min-h-11 items-center rounded-xl border px-4 py-2 text-sm font-semibold"
          >
            Receipts
          </Link>
          <Link
            prefetch={false}
            href="/cashier/order"
            className="inline-flex min-h-11 items-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            New table order
          </Link>
          <Link
            prefetch={false}
            href="/cashier/takeaway"
            className="border-border bg-card hover:bg-muted inline-flex min-h-11 items-center rounded-xl border px-4 py-2 text-sm font-semibold"
          >
            Takeaway order
          </Link>
        </div>
        <Link
          prefetch={false}
          href="/cashier/customer-checkouts"
          className="inline-flex min-h-11 items-center rounded-xl border border-amber-600 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-900/30"
        >
          Customer payment review
        </Link>
      </div>

      {notice ? <ToastOnMount tone={notice.tone} description={notice.message} /> : null}

      <CashierTableBoard
        showEqualSplit={showEqualSplit}
        tables={tables.map((table) => ({
          id: table.id,
          name: table.name,
          checks: (openChecksByTable.get(table.id) ?? []).map((check) => ({
            key: check.key,
            orderNumber: check.orderNumber,
            total: check.total,
            rounds: check.rounds.map((round) => ({
              id: round.id,
              roundNumber: round.tableCheckRound ?? 1,
              time: formatDateTime(round.createdAt),
              cashierName: round.cashierName,
              items: round.items,
            })),
          })),
        }))}
      />
    </main>
  );
}
