import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/requireRole";
import SignOutButton from "../components/SignOutButton";
import AutoSubmitSelect from "../components/AutoSubmitSelect";
import {
  buildWaiterShiftSummary,
  getWaiterNextOpeningAmount,
} from "@/lib/waiter-shifts";
import {
  formatCashierBusinessDayRange,
  getCashierBusinessDayRange,
} from "@/lib/cashier-business-day";
import {
  closeWaiterBalanceFromCashier,
  reopenWaiterBalanceFromCashier,
  saveWaiterOpeningBalance,
} from "./actions";

type CashierPageProps = {
  searchParams?: Promise<{
    waiterId?: string;
    balanceStatus?: string;
  }>;
};

function formatMoney(value: number | null) {
  if (value == null) {
    return "--";
  }

  return `$${value.toFixed(2)}`;
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

export default async function CashierPage({ searchParams }: CashierPageProps) {
  const currentUser = await requireRole(["CASHIER", "ADMIN"]);
  const params = await searchParams;
  const { start: businessDayStart, end: businessDayEnd } =
    getCashierBusinessDayRange();
  const businessDayLabel = formatCashierBusinessDayRange(
    businessDayStart,
    businessDayEnd,
  );
  const balanceNotice = getBalanceStatusMessage(params?.balanceStatus);

  const waiters = await prisma.user.findMany({
    where: {
      role: "WAITER",
      isActive: true,
    },
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
        },
        orderBy: {
          createdAt: "desc",
        },
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
        orderBy: {
          openedAt: "desc",
        },
        take: 1,
      },
    },
    orderBy: {
      fullName: "asc",
    },
  });

  const summaries = waiters.map((waiter) => {
    const totalOrders = waiter.waiterOrders.length;
    const totalSales = waiter.waiterOrders.reduce(
      (sum, order) => sum + Number(order.total || 0),
      0,
    );
    const shiftSummary = buildWaiterShiftSummary(waiter.shifts[0] ?? null, totalSales);

    return {
      id: waiter.id,
      fullName: waiter.fullName,
      email: waiter.email,
      role: waiter.role,
      totalOrders,
      totalSales,
      shiftSummary,
    };
  });

  const filteredSummaries = summaries.filter((staff) => staff.totalOrders > 0);

  const selectedWaiterId = waiters.some((waiter) => waiter.id === params?.waiterId)
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

  const grandTotalOrders = filteredSummaries.reduce(
    (sum, staff) => sum + staff.totalOrders,
    0,
  );
  const grandTotalSales = filteredSummaries.reduce(
    (sum, staff) => sum + staff.totalSales,
    0,
  );

  return (
    <main className="p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard-ka Cashier</h1>
          <p className="mt-2 text-lg text-slate-700">
            Welcome {currentUser.fullName}
          </p>
          <p className="text-sm text-slate-500">
            Maalinta cashier-ka: {businessDayLabel}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/cashier/waiter-orders"
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Dalabyada Waiter-ka
          </Link>
          <SignOutButton />
        </div>
      </div>

      {balanceNotice ? (
        <div
          className={`mb-6 rounded-2xl px-4 py-3 text-sm font-medium ${
            balanceNotice.tone === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {balanceNotice.message}
        </div>
      ) : null}

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm text-slate-500">
          Select a waiter below to manage shifts and balances.
        </div>
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">
              Waiter balance management
            </h2>
            <p className="text-sm text-slate-500">
              Select a waiter, enter the opening balance, then close the balance.
            </p>
          </div>

          <form className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_auto] md:items-end">
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
              <div>
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Starting balance
                </span>
                <div className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3">
                  <p className="text-lg font-semibold text-slate-900">
                    {formatMoney(openingAmountDefaultValue)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Defaults to $0.00, or yesterday&apos;s negative carry-over
                    if one exists.
                  </p>
                  {showNextShiftCarryOver ? (
                    <p className="mt-2 text-xs font-semibold text-red-600">
                      Next shift carry-over: {formatMoney(recommendedOpeningAmount)}
                    </p>
                  ) : null}
                  {selectedWaiterIsClosed ? (
                    <p className="mt-2 text-xs text-amber-700">
                      This shift is already closed. Start shift will be available on the next business day.
                    </p>
                  ) : null}
                </div>
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
              action={closeWaiterBalanceFromCashier}
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
                    selectedWaiterSummary?.shiftSummary.expectedClosingAmount?.toFixed(2) ??
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
                  formAction={reopenWaiterBalanceFromCashier}
                  className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 font-semibold text-amber-800 hover:bg-amber-100"
                >
                  Reopen balance
                </button>
              ) : null}
            </form>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Selected waiter summary
          </h2>
          {selectedWaiterSummary ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-[0.15em] text-slate-500">
                  Waiter
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {selectedWaiterSummary.fullName}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-[0.15em] text-slate-500">
                    Opening
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {selectedWaiterSummary.shiftSummary.status === "not_opened"
                      ? "--"
                      : formatMoney(selectedWaiterSummary.shiftSummary.openingAmount)}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-[0.15em] text-slate-500">
                    Status
                  </p>
                  <p className="mt-1 text-lg font-semibold capitalize text-slate-900">
                    {selectedWaiterSummary.shiftSummary.status}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-[0.15em] text-slate-500">
                    Sales
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {formatMoney(selectedWaiterSummary.totalSales)}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-[0.15em] text-slate-500">
                    Expected close
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {formatMoney(
                      selectedWaiterSummary.shiftSummary.expectedClosingAmount,
                    )}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-[0.15em] text-slate-500">
                    Closing
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {formatMoney(selectedWaiterSummary.shiftSummary.closingAmount)}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-[0.15em] text-slate-500">
                    Difference
                  </p>
                  <p
                    className={`mt-1 text-lg font-semibold ${
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

              <p className="text-sm text-slate-500">
                Suggested next opening:{" "}
                <span
                  className={`font-semibold ${
                    recommendedOpeningAmount < 0
                      ? "text-red-600"
                      : "text-slate-800"
                  }`}
                >
                  {formatMoney(recommendedOpeningAmount)}
                </span>
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              No waiter selected.
            </p>
          )}
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Shaqaale leh dalabyo</p>
          <h2 className="mt-2 text-2xl font-bold">
            {filteredSummaries.length}
          </h2>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Totalka Dalabyada</p>
          <h2 className="mt-2 text-2xl font-bold">{grandTotalOrders}</h2>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Totalka libka</p>
          <h2 className="mt-2 text-2xl font-bold">
            ${grandTotalSales.toFixed(2)}
          </h2>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {filteredSummaries.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Dalab ma jiro</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    Magac
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    Dalabyo
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    iibka
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    Opening
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    Status
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    Difference
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredSummaries.map((staff) => (
                  <tr key={staff.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium">{staff.fullName}</td>
                    <td className="px-4 py-3">{staff.totalOrders}</td>
                    <td className="px-4 py-3">
                      ${staff.totalSales.toFixed(2)}
                    </td>
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
        )}
      </div>
    </main>
  );
}
