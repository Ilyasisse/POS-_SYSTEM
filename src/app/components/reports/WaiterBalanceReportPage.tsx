import Link from "next/link";
import { prisma } from "@/lib/prisma";
import SignOutButton from "@/app/components/SignOutButton";
import { buildWaiterShiftSummary } from "@/lib/waiter-shifts";
import {
  formatCashierBusinessDayRange,
  getCashierBusinessDayRange,
} from "@/lib/cashier-business-day";

type WaiterBalanceReportPageProps = {
  currentUserName: string;
  dashboardHref: string;
  dashboardLabel: string;
  searchParams?: {
    waiterId?: string;
    date?: string;
  };
};

function formatMoney(value: number | null) {
  if (value == null) {
    return "--";
  }

  return `$${value.toFixed(2)}`;
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateInput(dateInput?: string) {
  if (!dateInput) {
    return new Date();
  }

  const [year, month, day] = dateInput.split("-").map(Number);

  if (!year || !month || !day) {
    return new Date();
  }

  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function formatDateTime(value: Date | null) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

export default async function WaiterBalanceReportPage({
  currentUserName,
  dashboardHref,
  dashboardLabel,
  searchParams,
}: WaiterBalanceReportPageProps) {
  const anchorDate = parseDateInput(searchParams?.date);
  const { start: businessDayStart, end: businessDayEnd } =
    getCashierBusinessDayRange(anchorDate);
  const businessDayLabel = formatCashierBusinessDayRange(
    businessDayStart,
    businessDayEnd,
  );
  const selectedDate = formatDateInput(businessDayStart);

  const waiters = await prisma.user.findMany({
    where: {
      role: "WAITER",
      isActive: true,
    },
    select: {
      id: true,
      fullName: true,
    },
    orderBy: {
      fullName: "asc",
    },
  });

  const selectedWaiterId = waiters.some(
    (waiter) => waiter.id === searchParams?.waiterId,
  )
    ? (searchParams?.waiterId ?? "")
    : (waiters[0]?.id ?? "");
  const selectedWaiter =
    waiters.find((waiter) => waiter.id === selectedWaiterId) ?? null;

  const reportData = selectedWaiterId
    ? await Promise.all([
        prisma.shift.findFirst({
          where: {
            userId: selectedWaiterId,
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
          orderBy: {
            openedAt: "desc",
          },
        }),
        prisma.order.aggregate({
          where: {
            waiterId: selectedWaiterId,
            createdAt: {
              gte: businessDayStart,
              lt: businessDayEnd,
            },
          },
          _sum: {
            total: true,
          },
          _count: {
            id: true,
          },
        }),
      ])
    : null;

  const shiftSummary = reportData
    ? buildWaiterShiftSummary(
        reportData[0],
        Number(reportData[1]._sum.total ?? 0),
      )
    : null;
  const totalOrders = reportData ? Number(reportData[1]._count.id ?? 0) : 0;

  return (
    <main
      className="min-h-screen bg-linear-to-br from-slate-100 via-slate-50 to-blue-50 px-4 py-6 text-slate-900 md:px-6"
      style={{ fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif' }}
    >
      <div className="mx-auto w-full max-w-6xl space-y-4 pb-24">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Balance Reports
              </p>
              <h1 className="mt-2 text-2xl font-bold">Waiter Balance Report</h1>
              <p className="mt-1 text-sm text-slate-600">
                Review opening and closing balances for any waiter and business day.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Signed in as {currentUserName}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={dashboardHref}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {dashboardLabel}
              </Link>
              <SignOutButton />
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
          <form className="grid gap-4 md:grid-cols-[1fr_0.8fr_auto] md:items-end">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Waiter
              </span>
              <select
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
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Business day
              </span>
              <input
                type="date"
                name="date"
                defaultValue={selectedDate}
                className="w-full rounded-xl border border-slate-300 px-4 py-2 outline-none focus:border-blue-500"
              />
            </label>

            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
            >
              View report
            </button>
          </form>

          <p className="mt-3 text-sm text-slate-500">
            Business day range: {businessDayLabel}
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <p className="text-sm text-slate-500">Waiter</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">
              {selectedWaiter?.fullName ?? "--"}
            </h2>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <p className="text-sm text-slate-500">Status</p>
            <h2 className="mt-2 text-xl font-bold capitalize text-slate-900">
              {shiftSummary?.status ?? "--"}
            </h2>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <p className="text-sm text-slate-500">Opening Balance</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">
              {formatMoney(
                shiftSummary && shiftSummary.status !== "not_opened"
                  ? shiftSummary.openingAmount
                  : null,
              )}
            </h2>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <p className="text-sm text-slate-500">Closing Balance</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">
              {formatMoney(shiftSummary?.closingAmount ?? null)}
            </h2>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <p className="text-sm text-slate-500">Sales</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">
              {formatMoney(shiftSummary?.totalSales ?? null)}
            </h2>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <p className="text-sm text-slate-500">Orders</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">
              {totalOrders}
            </h2>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <h2 className="text-lg font-bold text-slate-800">Balance Summary</h2>
            {selectedWaiter === null ? (
              <p className="mt-4 text-sm text-slate-500">
                No waiter is available for reporting.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                  <span className="text-slate-600">Expected closing</span>
                  <span className="font-semibold text-slate-900">
                    {formatMoney(shiftSummary?.expectedClosingAmount ?? null)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                  <span className="text-slate-600">Closing minus opening</span>
                  <span className="font-semibold text-slate-900">
                    {formatMoney(shiftSummary?.salesFromDrawer ?? null)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                  <span className="text-slate-600">Difference</span>
                  <span
                    className={`font-semibold ${
                      shiftSummary?.variance != null && shiftSummary.variance < 0
                        ? "text-red-600"
                        : "text-slate-900"
                    }`}
                  >
                    {formatMoney(shiftSummary?.variance ?? null)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                  <span className="text-slate-600">Next opening carry-over</span>
                  <span
                    className={`font-semibold ${
                      shiftSummary?.nextOpeningAmount != null &&
                      shiftSummary.nextOpeningAmount < 0
                        ? "text-red-600"
                        : "text-slate-900"
                    }`}
                  >
                    {formatMoney(shiftSummary?.nextOpeningAmount ?? null)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <h2 className="text-lg font-bold text-slate-800">Shift Timeline</h2>
            {selectedWaiter === null ? (
              <p className="mt-4 text-sm text-slate-500">
                No waiter is available for reporting.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                  <span className="text-slate-600">Opened at</span>
                  <span className="font-semibold text-slate-900">
                    {formatDateTime(shiftSummary?.openedAt ?? null)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                  <span className="text-slate-600">Closed at</span>
                  <span className="font-semibold text-slate-900">
                    {formatDateTime(shiftSummary?.closedAt ?? null)}
                  </span>
                </div>
                <div className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">
                  {shiftSummary?.status === "not_opened"
                    ? "No opening balance record was found for this waiter on the selected date."
                    : shiftSummary?.status === "open"
                      ? "The shift was opened but not closed on the selected business day."
                      : "The shift has both opening and closing balances recorded."}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
