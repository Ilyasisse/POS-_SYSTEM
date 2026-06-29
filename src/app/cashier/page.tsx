"use server"
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import SignOutButton from "@/components/SignOutButton";
import {
  formatCashierBusinessDayRange,
  getCashierBusinessDayRange,
} from "@/lib/cashier/cashier-business-day";
import { payOpenTableOrdersFromCashier } from "./actions";
import CashierLiveSync from "@/components/cashier/CashierLiveSync";

type CashierPageProps = {
  searchParams?: Promise<{
    paymentStatus?: string;
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
  const currentUser = await requirePermission(PERMISSIONS.ORDER_MANAGE);
  const params = await searchParams;
  const paymentNotice = getPaymentStatusMessage(params?.paymentStatus);
  const { start: businessDayStart, end: businessDayEnd } =
    getCashierBusinessDayRange();
  const businessDayLabel = formatCashierBusinessDayRange(
    businessDayStart,
    businessDayEnd,
  );

  // Resolve URL state with auth, but keep protected table reads after auth.
  const [currentUser, params] = await Promise.all([
    requireAuth(["CASHIER", "ADMIN"]),
    searchParams,
  ]);
  const paymentNotice = getPaymentStatusMessage(params?.paymentStatus);

  const tables = await prisma.table.findMany({
    where: {
      isActive: true,
      orders: {
        some: {
          status: "OPEN",
          type: "DINE_IN",
          createdAt: {
            gte: businessDayStart,
            lt: businessDayEnd,
          },
        },
      },
    },
    orderBy: { name: "asc" },
    include: {
      orders: {
        where: {
          status: "OPEN",
          type: "DINE_IN",
          createdAt: {
            gte: businessDayStart,
            lt: businessDayEnd,
          },
        },
        orderBy: { createdAt: "desc" },
        include: {
          cashier: { select: { fullName: true } },
          orderItems: {
            select: {
              id: true,
              productName: true,
              qty: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  const openOrders = tables.flatMap((table) =>
    table.orders.map((order) => ({
      ...order,
      tableName: table.name,
    })),
  );
  const openOrderTotal = openOrders.reduce(
    (sum, order) => sum + Number(order.total),
    0,
  );

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <CashierLiveSync />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Cashier table settlement</h1>
          <p className="mt-2 text-lg text-slate-700">
            Welcome {currentUser.fullName}
          </p>
          <p className="text-sm text-slate-500">
            Business day: {businessDayLabel}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/cashier/order"
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            New table order
          </Link>
          <SignOutButton />
        </div>
      </div>

      {paymentNotice ? (
        <div
          className={`mb-6 rounded-2xl px-4 py-3 text-sm font-medium ${
            paymentNotice.tone === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {paymentNotice.message}
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Occupied tables</p>
          <h2 className="mt-2 text-2xl font-bold">{tables.length}</h2>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Open orders</p>
          <h2 className="mt-2 text-2xl font-bold">{openOrders.length}</h2>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Open order total</p>
          <h2 className="mt-2 text-2xl font-bold">
            {formatMoney(openOrderTotal)}
          </h2>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tables.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600 shadow-sm md:col-span-2 xl:col-span-3">
            <h2 className="text-lg font-bold text-slate-900">
              No occupied tables
            </h2>
            <p className="mt-2">
              Tables appear here only after an unpaid table order is sent. Use
              New table order to start service for an active table.
            </p>
          </div>
        ) : (
          tables.map((table) => {
            const tableTotal = table.orders.reduce(
              (sum, order) => sum + Number(order.total),
              0,
            );

            return (
              <article
                key={table.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">Table</p>
                    <h2 className="text-2xl font-bold text-slate-900">
                      {table.name}
                    </h2>
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase text-amber-700">
                    occupied
                  </span>
                </div>

                <div className="mb-4 rounded-xl bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Open orders</span>
                    <span className="font-semibold">{table.orders.length}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="text-slate-500">Table total</span>
                    <span className="font-semibold">{formatMoney(tableTotal)}</span>
                  </div>
                </div>

                <div className="mb-4 grid gap-2">
                  <Link
                    href={`/cashier/order?tableId=${encodeURIComponent(table.id)}`}
                    className="block rounded-xl bg-emerald-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    Add order
                  </Link>
                  <form
                    action={payOpenTableOrdersFromCashier}
                    className="grid gap-2 sm:grid-cols-[1fr_auto]"
                  >
                    <input type="hidden" name="tableId" value={table.id} />
                    <select
                      name="paymentMethod"
                      defaultValue="GOLIS"
                      className="min-h-11 rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                    >
                      <option value="GOLIS">GOLIS</option>
                      <option value="MYCASH">MYCASH</option>
                      <option value="Dahabshiil">Dahabshiil</option>
                      <option value="OTHER">OTHER</option>
                    </select>
                    <button
                      type="submit"
                      className="min-h-11 rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800"
                    >
                      Pay {formatMoney(tableTotal)}
                    </button>
                  </form>
                </div>

                <div className="space-y-3">
                  {table.orders.map((order) => (
                    <div
                      key={order.id}
                      className="rounded-xl border border-slate-200 px-3 py-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-900">
                            Order #{order.orderNumber}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatDateTime(order.createdAt)}
                            {order.cashier?.fullName
                              ? ` by ${order.cashier.fullName}`
                              : ""}
                          </p>
                        </div>
                        <p className="font-bold text-slate-900">
                          {formatMoney(Number(order.total))}
                        </p>
                      </div>

                      <p className="mt-2 text-sm text-slate-600">
                        {order.orderItems
                          .map((item) => `${item.qty}x ${item.productName}`)
                          .join(", ")}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
