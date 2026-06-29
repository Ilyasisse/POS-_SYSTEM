import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import AutoSubmitSelect from "@/components/AutoSubmitSelect";
import SignOutButton from "@/components/SignOutButton";
import {
  buildWaiterShiftSummary,
  getWaiterNextOpeningAmount,
} from "@/lib/waiter/waiter-shifts";
import {
  formatCashierBusinessDayRange,
  getCashierBusinessDayRange,
} from "@/lib/cashier/cashier-business-day";
import {
  closeWaiterBalanceFromManager,
  reopenWaiterBalanceFromManager,
  saveWaiterOpeningBalance,
} from "./actions";

type ManagerPageProps = {
  searchParams?: Promise<{
    waiterId?: string;
    balanceStatus?: string;
  }>;
};

type Alert = {
  tone: "warning" | "danger";
  title: string;
  message: string;
};

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatMoney(value: number | null) {
  if (value == null) return "--";
  return `$${value.toFixed(2)}`;
}

function formatDateTime(date: Date) {
  return dateTimeFormatter.format(date);
}

function getBalanceStatusMessage(balanceStatus?: string) {
  switch (balanceStatus) {
    case "opening_saved":
      return {
        tone: "success" as const,
        message: "The opening balance has been saved.",
      };
    case "opening_updated":
      return {
        tone: "success" as const,
        message: "The opening balance has been updated.",
      };
    case "closing_saved":
      return {
        tone: "success" as const,
        message: "The closing balance has been saved.",
      };
    case "reopened_saved":
      return {
        tone: "success" as const,
        message: "The balance has been reopened.",
      };
    case "invalid_opening_amount":
      return {
        tone: "error" as const,
        message: "Please enter a valid opening balance.",
      };
    case "invalid_closing_amount":
      return {
        tone: "error" as const,
        message: "Please enter a valid closing balance.",
      };
    case "shift_already_closed":
      return {
        tone: "error" as const,
        message: "This waiter's balance has already been closed today.",
      };
    case "waiter_not_found":
      return {
        tone: "error" as const,
        message: "The selected waiter could not be found.",
      };
    case "no_open_shift":
      return {
        tone: "error" as const,
        message: "There is no open balance for this waiter.",
      };
    case "no_closed_shift":
      return {
        tone: "error" as const,
        message: "There is no closed balance for this waiter.",
      };
    case "opening_failed":
      return {
        tone: "error" as const,
        message: "The opening balance could not be saved.",
      };
    case "closing_failed":
      return {
        tone: "error" as const,
        message: "The closing balance could not be saved.",
      };
    case "reopen_failed":
      return {
        tone: "error" as const,
        message: "The balance could not be reopened.",
      };
    default:
      return null;
  }
}

type BalanceNotice = NonNullable<ReturnType<typeof getBalanceStatusMessage>>;

type WaiterOption = {
  id: string;
  fullName: string;
};

type WaiterSummary = {
  id: string;
  fullName: string;
  totalOrders: number;
  totalSales: number;
  shiftSummary: ReturnType<typeof buildWaiterShiftSummary>;
  hasClosedShift: boolean;
  hasOrdersWithoutPayments: boolean;
};

type OpenTableOrderRow = {
  id: string;
  orderNumber: number;
  total: unknown;
  createdAt: Date;
  table: { id: string; name: string } | null;
  cashier: { fullName: string } | null;
  orderItems: Array<{
    id: string;
    productName: string;
    qty: number;
  }>;
};

type ManagerPageHeaderProps = {
  fullName: string;
  businessDayLabel: string;
};

type ManagerMetricCardsProps = {
  waiterCount: number;
  grandTotalOrders: number;
  grandTotalSales: number;
  openTableTotal: number;
};

type WaiterBalanceManagementProps = {
  waiters: WaiterOption[];
  selectedWaiterId: string;
  selectedWaiterSummary: WaiterSummary | null;
  openingAmountDefaultValue: number;
  recommendedOpeningAmount: number;
  showNextShiftCarryOver: boolean;
  selectedWaiterHasOpenShift: boolean;
  selectedWaiterIsClosed: boolean;
};

function ManagerPageHeader({
  fullName,
  businessDayLabel,
}: ManagerPageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">Manager balance dashboard</h1>
        <p className="mt-2 text-lg text-slate-700">Welcome {fullName}</p>
        <p className="text-sm text-slate-500">
          Business day: {businessDayLabel}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/manager/waiter-orders"
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Waiter order review
        </Link>
        <Link
          href="/manager/reports"
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Reports
        </Link>
        <SignOutButton />
      </div>
    </div>
  );
}

function BalanceNoticeBanner({ notice }: { notice: BalanceNotice }) {
  return (
    <div
      className={`mb-6 rounded-2xl px-4 py-3 text-sm font-medium ${
        notice.tone === "success"
          ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {notice.message}
    </div>
  );
}

function ManagerMetricCards({
  waiterCount,
  grandTotalOrders,
  grandTotalSales,
  openTableTotal,
}: ManagerMetricCardsProps) {
  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-500">Waiters</p>
        <h2 className="mt-2 text-2xl font-bold">{waiterCount}</h2>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-500">Waiter orders</p>
        <h2 className="mt-2 text-2xl font-bold">{grandTotalOrders}</h2>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-500">Waiter sales</p>
        <h2 className="mt-2 text-2xl font-bold">
          {formatMoney(grandTotalSales)}
        </h2>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-500">Open table total</p>
        <h2 className="mt-2 text-2xl font-bold">
          {formatMoney(openTableTotal)}
        </h2>
      </div>
    </div>
  );
}

function OperationalAlertsPanel({ alerts }: { alerts: Alert[] }) {
  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-lg font-bold text-slate-900">Operational alerts</h2>
        <p className="text-sm text-slate-500">
          Display-only alerts for table flow and balance issues.
        </p>
      </div>
      {alerts.length === 0 ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          No unusual activity detected.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {alerts.map((alert, index) => (
            <div
              key={`${alert.title}-${index}`}
              className={`rounded-xl border px-4 py-3 ${
                alert.tone === "danger"
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              <p className="font-semibold">{alert.title}</p>
              <p className="mt-1 text-sm">{alert.message}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function WaiterBalanceManagement({
  waiters,
  selectedWaiterId,
  selectedWaiterSummary,
  openingAmountDefaultValue,
  recommendedOpeningAmount,
  showNextShiftCarryOver,
  selectedWaiterHasOpenShift,
  selectedWaiterIsClosed,
}: WaiterBalanceManagementProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-900">
          Waiter balance management
        </h2>
        <p className="text-sm text-slate-500">
          Select a waiter, start the balance, then close or reopen it.
        </p>
      </div>

      <form className="grid gap-3 md:grid-cols-[1.2fr_0.8fr] md:items-end">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Waiter
          </span>
          <AutoSubmitSelect
            name="waiterId"
            defaultValue={selectedWaiterId}
            className="w-full rounded-xl border border-slate-300 px-4 py-2 outline-none focus:border-blue-500"
          >
            {waiters.length === 0 ? (
              <option value="">No waiters found</option>
            ) : (
              waiters.map((waiter) => (
                <option key={waiter.id} value={waiter.id}>
                  {waiter.fullName}
                </option>
              ))
            )}
          </AutoSubmitSelect>
        </label>
        <div className="text-sm text-slate-500 md:pb-2">
          {selectedWaiterSummary ? (
            <p>
              Today&apos;s sales:{" "}
              <span className="font-semibold text-slate-800">
                {formatMoney(selectedWaiterSummary.totalSales)}
              </span>
            </p>
          ) : (
            <p>Select a waiter to manage the balance.</p>
          )}
        </div>
      </form>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <form
          action={saveWaiterOpeningBalance}
          className="rounded-xl border border-slate-200 p-4"
        >
          <input type="hidden" name="waiterId" value={selectedWaiterId} />
          <input
            type="hidden"
            name="openingAmount"
            value={openingAmountDefaultValue.toFixed(2)}
          />
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Starting balance
          </span>
          <div className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3">
            <p className="text-lg font-semibold text-slate-900">
              {formatMoney(openingAmountDefaultValue)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Defaults to $0.00, or yesterday&apos;s negative carry-over.
            </p>
            {showNextShiftCarryOver ? (
              <p className="mt-2 text-xs font-semibold text-red-600">
                Next shift carry-over: {formatMoney(recommendedOpeningAmount)}
              </p>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={
              !selectedWaiterId ||
              Boolean(selectedWaiterIsClosed) ||
              Boolean(selectedWaiterHasOpenShift)
            }
            className="mt-4 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Start shift
          </button>
        </form>

        <form
          action={closeWaiterBalanceFromManager}
          className="rounded-xl border border-slate-200 p-4"
        >
          <input type="hidden" name="waiterId" value={selectedWaiterId} />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Closing balance
            </span>
            <input
              type="number"
              name="closingAmount"
              step="0.01"
              defaultValue={
                selectedWaiterSummary?.shiftSummary.closingAmount?.toFixed(2) ??
                selectedWaiterSummary?.shiftSummary.expectedClosingAmount?.toFixed(
                  2,
                ) ??
                ""
              }
              className="w-full rounded-xl border border-slate-300 px-4 py-2 outline-none focus:border-blue-500"
              placeholder="0.00"
            />
          </label>
          <button
            type="submit"
            disabled={!selectedWaiterId || Boolean(selectedWaiterIsClosed)}
            className="mt-4 rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Close balance
          </button>
          {selectedWaiterIsClosed ? (
            <button
              type="submit"
              formAction={reopenWaiterBalanceFromManager}
              className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 font-semibold text-amber-800 hover:bg-amber-100"
            >
              Reopen balance
            </button>
          ) : null}
        </form>
      </div>
    </section>
  );
}

function SelectedWaiterSummaryCard({
  selectedWaiterSummary,
}: {
  selectedWaiterSummary: WaiterSummary | null;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">
        Selected waiter summary
      </h2>
      {selectedWaiterSummary ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-[0.15em] text-slate-500">
              Waiter
            </p>
            <p className="mt-1 font-semibold text-slate-900">
              {selectedWaiterSummary.fullName}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-[0.15em] text-slate-500">
              Status
            </p>
            <p className="mt-1 font-semibold capitalize text-slate-900">
              {selectedWaiterSummary.shiftSummary.status}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-[0.15em] text-slate-500">
              Expected close
            </p>
            <p className="mt-1 font-semibold text-slate-900">
              {formatMoney(
                selectedWaiterSummary.shiftSummary.expectedClosingAmount,
              )}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-[0.15em] text-slate-500">
              Difference
            </p>
            <p
              className={`mt-1 font-semibold ${
                selectedWaiterSummary.shiftSummary.variance != null &&
                selectedWaiterSummary.shiftSummary.variance < 0
                  ? "text-red-600"
                  : "text-slate-900"
              }`}
            >
              {formatMoney(selectedWaiterSummary.shiftSummary.variance)}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">No waiter selected.</p>
      )}
    </section>
  );
}

function OpenTableOrdersSection({
  openTableOrders,
}: {
  openTableOrders: OpenTableOrderRow[];
}) {
  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="font-semibold text-slate-900">Open table orders</h2>
      </div>
      {openTableOrders.length === 0 ? (
        <div className="p-6 text-sm text-slate-500">
          No unpaid table orders.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-700">
                  Order
                </th>
                <th className="px-4 py-3 font-semibold text-slate-700">
                  Table
                </th>
                <th className="px-4 py-3 font-semibold text-slate-700">
                  Cashier
                </th>
                <th className="px-4 py-3 font-semibold text-slate-700">
                  Items
                </th>
                <th className="px-4 py-3 font-semibold text-slate-700">
                  Total
                </th>
                <th className="px-4 py-3 font-semibold text-slate-700">
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {openTableOrders.map((order) => (
                <tr key={order.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-semibold">
                    #{order.orderNumber}
                  </td>
                  <td className="px-4 py-3">{order.table?.name ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {order.cashier?.fullName ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {order.orderItems
                      .map((item) => `${item.qty}x ${item.productName}`)
                      .join(", ")}
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {formatMoney(Number(order.total))}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDateTime(order.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function WaiterBalanceSummaryTable({
  summaries,
}: {
  summaries: WaiterSummary[];
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="font-semibold text-slate-900">Waiter balance summary</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-700">Name</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Orders</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Sales</th>
              <th className="px-4 py-3 font-semibold text-slate-700">
                Opening
              </th>
              <th className="px-4 py-3 font-semibold text-slate-700">Status</th>
              <th className="px-4 py-3 font-semibold text-slate-700">
                Difference
              </th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((staff) => (
              <tr key={staff.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{staff.fullName}</td>
                <td className="px-4 py-3">{staff.totalOrders}</td>
                <td className="px-4 py-3">{formatMoney(staff.totalSales)}</td>
                <td className="px-4 py-3">
                  {staff.shiftSummary.status === "not_opened"
                    ? "--"
                    : formatMoney(staff.shiftSummary.openingAmount)}
                </td>
                <td className="px-4 py-3 capitalize">
                  {staff.shiftSummary.status}
                </td>
                <td
                  className={`px-4 py-3 ${
                    staff.shiftSummary.variance != null &&
                    staff.shiftSummary.variance < 0
                      ? "font-semibold text-red-600"
                      : ""
                  }`}
                >
                  {formatMoney(staff.shiftSummary.variance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function ManagerPage({ searchParams }: ManagerPageProps) {
  const { start: businessDayStart, end: businessDayEnd } =
    getCashierBusinessDayRange();
  const businessDayLabel = formatCashierBusinessDayRange(
    businessDayStart,
    businessDayEnd,
  );

  const [currentUser, params, [waiters, openTableOrders]] = await Promise.all([
    requirePermission(PERMISSIONS.DASHBOARD_VIEW),
    searchParams,
    Promise.all([
      prisma.user.findMany({
        where: { role: "WAITER", isActive: true },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          waiterOrders: {
            where: {
              createdAt: {
                gte: businessDayStart,
                lt: businessDayEnd,
              },
            },
            select: {
              id: true,
              total: true,
              createdAt: true,
              payments: { select: { id: true } },
            },
            orderBy: { createdAt: "desc" },
          },
          shifts: {
            where: {
              openedAt: {
                gte: businessDayStart,
                lt: businessDayEnd,
              },
            },
            select: {
              id: true,
              openingAmount: true,
              closingAmount: true,
              openedAt: true,
              closedAt: true,
            },
            orderBy: { openedAt: "desc" },
            take: 1,
          },
        },
        orderBy: { fullName: "asc" },
      }),
      prisma.order.findMany({
        where: {
          status: "OPEN",
          type: "DINE_IN",
          tableId: { not: null },
          createdAt: {
            gte: businessDayStart,
            lt: businessDayEnd,
          },
        },
        orderBy: { createdAt: "desc" },
        include: {
          table: { select: { id: true, name: true } },
          cashier: { select: { fullName: true } },
          orderItems: {
            select: { id: true, productName: true, qty: true },
            orderBy: { createdAt: "asc" },
          },
        },
      }),
    ]),
  ]);
  const balanceNotice = getBalanceStatusMessage(params?.balanceStatus);

  const summaries = waiters.map((waiter) => {
    const totalOrders = waiter.waiterOrders.length;
    const totalSales = waiter.waiterOrders.reduce(
      (sum, order) => sum + Number(order.total || 0),
      0,
    );
    const shiftSummary = buildWaiterShiftSummary(
      waiter.shifts[0] ?? null,
      totalSales,
    );

    return {
      id: waiter.id,
      fullName: waiter.fullName,
      email: waiter.email,
      role: waiter.role,
      totalOrders,
      totalSales,
      shiftSummary,
      hasClosedShift: Boolean(waiter.shifts[0]?.closedAt),
      hasOrdersWithoutPayments: waiter.waiterOrders.some(
        (order) => order.payments.length === 0,
      ),
    };
  });

  const selectedWaiterId = waiters.some(
    (waiter) => waiter.id === params?.waiterId,
  )
    ? (params?.waiterId ?? "")
    : (waiters[0]?.id ?? "");
  const selectedWaiterSummary =
    summaries.find((summary) => summary.id === selectedWaiterId) ?? null;
  const recommendedOpeningAmount = selectedWaiterId
    ? await getWaiterNextOpeningAmount(selectedWaiterId)
    : 0;
  const openingAmountDefaultValue =
    selectedWaiterSummary?.shiftSummary.status === "open"
      ? selectedWaiterSummary.shiftSummary.openingAmount
      : recommendedOpeningAmount;
  const selectedWaiterHasOpenShift =
    selectedWaiterSummary?.shiftSummary.status === "open";
  const selectedWaiterIsClosed =
    selectedWaiterSummary?.shiftSummary.status === "closed";
  const showNextShiftCarryOver =
    Boolean(selectedWaiterIsClosed) && recommendedOpeningAmount < 0;

  const grandTotalOrders = summaries.reduce(
    (sum, staff) => sum + staff.totalOrders,
    0,
  );
  const grandTotalSales = summaries.reduce(
    (sum, staff) => sum + staff.totalSales,
    0,
  );
  const openTableTotal = openTableOrders.reduce(
    (sum, order) => sum + Number(order.total),
    0,
  );
  const tableOrderCounts = openTableOrders.reduce<Record<string, number>>(
    (accumulator, order) => {
      const tableName = order.table?.name ?? "Unknown";
      accumulator[tableName] = (accumulator[tableName] ?? 0) + 1;
      return accumulator;
    },
    {},
  );
  const currentTime = new Date().getTime();
  const alerts: Alert[] = [
    ...openTableOrders.flatMap((order) =>
      currentTime - order.createdAt.getTime() > 60 * 60 * 1000
        ? [
            {
              tone: "warning" as const,
              title: `Long open order #${order.orderNumber}`,
              message: `${order.table?.name ?? "Table"} has been unpaid since ${formatDateTime(order.createdAt)}.`,
            },
          ]
        : [],
    ),
    ...summaries.flatMap((summary) =>
      summary.shiftSummary.variance != null && summary.shiftSummary.variance < 0
        ? [
            {
              tone: "danger" as const,
              title: `${summary.fullName} has a negative balance variance`,
              message: `Variance is ${formatMoney(summary.shiftSummary.variance)}.`,
            },
          ]
        : [],
    ),
    ...summaries.flatMap((summary) =>
      summary.hasClosedShift && summary.hasOrdersWithoutPayments
        ? [
            {
              tone: "warning" as const,
              title: `${summary.fullName} has closed shift order inconsistencies`,
              message:
                "At least one order in the business day has no payment recorded.",
            },
          ]
        : [],
    ),
    ...Object.entries(tableOrderCounts).flatMap(([tableName, count]) =>
      count > 1
        ? [
            {
              tone: "warning" as const,
              title: `${tableName} has multiple open orders`,
              message: `${count} unpaid orders are currently open for this table.`,
            },
          ]
        : [],
    ),
  ];

  return (
    <main className="p-6">
      <ManagerPageHeader
        fullName={currentUser.fullName}
        businessDayLabel={businessDayLabel}
      />

      {balanceNotice ? <BalanceNoticeBanner notice={balanceNotice} /> : null}

      <ManagerMetricCards
        waiterCount={summaries.length}
        grandTotalOrders={grandTotalOrders}
        grandTotalSales={grandTotalSales}
        openTableTotal={openTableTotal}
      />

      <OperationalAlertsPanel alerts={alerts} />

      <div className="mb-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <WaiterBalanceManagement
          waiters={waiters}
          selectedWaiterId={selectedWaiterId}
          selectedWaiterSummary={selectedWaiterSummary}
          openingAmountDefaultValue={openingAmountDefaultValue}
          recommendedOpeningAmount={recommendedOpeningAmount}
          showNextShiftCarryOver={showNextShiftCarryOver}
          selectedWaiterHasOpenShift={Boolean(selectedWaiterHasOpenShift)}
          selectedWaiterIsClosed={Boolean(selectedWaiterIsClosed)}
        />

        <SelectedWaiterSummaryCard
          selectedWaiterSummary={selectedWaiterSummary}
        />
      </div>

      <OpenTableOrdersSection openTableOrders={openTableOrders} />

      <WaiterBalanceSummaryTable summaries={summaries} />
    </main>
  );
}
