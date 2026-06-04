import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getInventoryAlertStatus } from "@/lib/inventory";
import {
  adjustSupplyInventory,
  createSupply,
  updateSupplyInventory,
} from "./actions";

// Tracks the number of supplies in each inventory status bucket.
type StatusSummary = {
  ok: number;
  low: number;
  out: number;
};

// Represents the daily total taken for one supply item.
type TakenSummary = {
  itemName: string;
  quantity: number;
};

// Describes the query parameters accepted by the admin inventory page.
type AdminInventoryPageProps = {
  searchParams?: Promise<{
    inventoryEmail?: string;
  }>;
};

// Lists the popup states that can be shown after an inventory email attempt.
type InventoryEmailStatus = "sent" | "failed" | "skipped" | "none";

// Defines the UTC offset used for the cafe's East Africa Time reporting day.
const EAT_OFFSET_HOURS = 3;

// Calculates the beginning of the current East Africa Time day.
function getEatDayStart(date = new Date()) {
  // Shifts the current time into East Africa Time before truncating to midnight.
  const eatNow = new Date(date.getTime() + EAT_OFFSET_HOURS * 60 * 60 * 1000);

  // Builds the UTC timestamp for midnight in the shifted day.
  const eatStart = Date.UTC(
    eatNow.getUTCFullYear(),
    eatNow.getUTCMonth(),
    eatNow.getUTCDate(),
  );

  return new Date(eatStart - EAT_OFFSET_HOURS * 60 * 60 * 1000);
}

// Returns the badge colors for an inventory status.
function getStatusClasses(status: "OK" | "LOW" | "OUT") {
  if (status === "OUT") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (status === "LOW") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  return "bg-emerald-50 text-emerald-700 ring-emerald-200";
}

// Adds one supply to the matching status count.
function addStatus(summary: StatusSummary, status: "OK" | "LOW" | "OUT") {
  if (status === "OUT") {
    summary.out += 1;
  } else if (status === "LOW") {
    summary.low += 1;
  } else {
    summary.ok += 1;
  }
}

// Groups today's negative inventory movements into per-item totals.
function summarizeTakenToday(
  movements: Array<{ itemName: string; delta: number }>,
) {
  // Stores the running taken quantity for each supply name.
  const byItemName = new Map<string, number>();

  for (const movement of movements) {
    byItemName.set(
      movement.itemName,
      (byItemName.get(movement.itemName) ?? 0) + Math.abs(movement.delta),
    );
  }

  return [...byItemName.entries()]
    .map<TakenSummary>(([itemName, quantity]) => ({ itemName, quantity }))
    .sort((first, second) => second.quantity - first.quantity);
}

// Converts the inventoryEmail query string into a supported popup status.
function getInventoryEmailStatus(value?: string): InventoryEmailStatus | null {
  if (
    value === "sent" ||
    value === "failed" ||
    value === "skipped" ||
    value === "none"
  ) {
    return value;
  }

  return null;
}

// Shows a fixed popup explaining whether the inventory email was sent.
function InventoryEmailPopup({ status }: { status: InventoryEmailStatus }) {
  // Maps each email result to the text and colors shown in the popup.
  const config = {
    sent: {
      title: "Inventory email sent",
      message: "The low-stock email was accepted by Resend.",
      classes: "border-emerald-200 bg-emerald-50 text-emerald-900",
    },
    failed: {
      title: "Inventory email failed",
      message: "Resend rejected the alert. Check the server logs for details.",
      classes: "border-red-200 bg-red-50 text-red-900",
    },
    skipped: {
      title: "Inventory email skipped",
      message: "Email settings are missing in the server environment.",
      classes: "border-amber-200 bg-amber-50 text-amber-900",
    },
    none: {
      title: "No inventory email needed",
      message: "The stock change did not create a new email alert.",
      classes: "border-slate-200 bg-white text-slate-900",
    },
  }[status];

  return (
    <div
      role="status"
      className={`fixed right-4 top-4 z-50 w-[min(360px,calc(100vw-2rem))] rounded-xl border p-4 shadow-xl ${config.classes}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold">{config.title}</p>
          <p className="mt-1 text-sm">{config.message}</p>
        </div>
        <Link
          href="/admin/inventory"
          className="rounded-md px-2 py-1 text-sm font-bold hover:bg-black/5"
          aria-label="Dismiss inventory email message"
        >
          x
        </Link>
      </div>
    </div>
  );
}

export default async function AdminInventoryPage({
  searchParams,
}: AdminInventoryPageProps) {
  // Reads popup status from the URL after server actions redirect back here.
  const params = await searchParams;
  const inventoryEmailStatus = getInventoryEmailStatus(params?.inventoryEmail);

  // Uses the cafe's local day boundary for the "Taken Today" report.
  const todayStart = getEatDayStart();

  // Loads active supplies, recent movements, and today's taken movements in parallel.
  const [supplies, movements, takenTodayMovements] = await Promise.all([
    prisma.inventorySupply.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ stockQty: "asc" }, { name: "asc" }],
    }),
    prisma.inventoryMovement.findMany({
      where: {
        itemType: "Supply",
        supplyId: {
          not: null,
        },
      },
      take: 12,
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.inventoryMovement.findMany({
      where: {
        itemType: "Supply",
        supplyId: {
          not: null,
        },
        delta: {
          lt: 0,
        },
        createdAt: {
          gte: todayStart,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        itemName: true,
        delta: true,
        quantityAfter: true,
        reason: true,
        note: true,
        createdAt: true,
      },
    }),
  ]);

  // Counts supplies by current status for the summary cards.
  const summary = supplies.reduce<StatusSummary>(
    (accumulator, supply) => {
      addStatus(
        accumulator,
        getInventoryAlertStatus(supply.stockQty, supply.lowStockThreshold),
      );
      return accumulator;
    },
    { ok: 0, low: 0, out: 0 },
  );

  // Aggregates today's taken movement rows into display totals.
  const takenSummary = summarizeTakenToday(takenTodayMovements);

  return (
    <main
      className="min-h-screen bg-linear-to-br from-slate-100 via-slate-50 to-blue-50 px-4 py-6 text-slate-900 md:px-6"
      style={{ fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif' }}
    >
      {inventoryEmailStatus ? (
        <InventoryEmailPopup status={inventoryEmailStatus} />
      ) : null}

      <div className="mx-auto w-full max-w-7xl space-y-4 pb-24">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Admin Dashboard
            </p>
            <h1 className="text-2xl font-bold">Internal Inventory</h1>
            <p className="text-sm text-slate-500">
              Track supplies brought in, taken during the day, and low-stock
              alerts.
            </p>
          </div>

          <Link
            href="/admin"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Dashboard
          </Link>
        </header>

        <section className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
              OK
            </p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">
              {summary.ok}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
              Low
            </p>
            <p className="mt-2 text-3xl font-bold text-amber-700">
              {summary.low}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
              Out
            </p>
            <p className="mt-2 text-3xl font-bold text-red-700">
              {summary.out}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
              Taken Today
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-800">
              {takenTodayMovements.length}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Internal Supplies
              </h2>
              <p className="text-sm text-slate-500">
                Create supplies such as flour, sugar, cups, milk, and packaging.
              </p>
            </div>
            <form
              action={createSupply}
              className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap"
            >
              <input
                name="name"
                type="text"
                placeholder="Item name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-40"
                required
              />
              <input
                name="unit"
                type="text"
                placeholder="Unit"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-24"
              />
              <input
                name="stockQty"
                type="number"
                min="0"
                placeholder="Stock"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-24"
              />
              <input
                name="lowStockThreshold"
                type="number"
                min="0"
                placeholder="Low"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-24"
              />
              <button
                type="submit"
                className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 sm:w-auto"
              >
                Create
              </button>
            </form>
          </div>

          <div className="mt-4 space-y-3 xl:hidden">
            {supplies.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                No internal supplies created yet.
              </div>
            ) : (
              supplies.map((supply) => {
                // Recomputes status from stock values so the card reflects current data.
                const status = getInventoryAlertStatus(
                  supply.stockQty,
                  supply.lowStockThreshold,
                );

                return (
                  <article
                    key={supply.id}
                    className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words text-base font-bold text-slate-800">
                          {supply.name}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          {supply.stockQty} {supply.unit} on hand
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ring-1 ${getStatusClasses(status)}`}
                      >
                        {status}
                      </span>
                    </div>

                    <form
                      action={updateSupplyInventory}
                      className="mt-4 grid min-w-0 grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2"
                    >
                      <input type="hidden" name="supplyId" value={supply.id} />
                      <label className="min-w-0 text-xs font-semibold text-slate-600">
                        Stock
                        <input
                          name="stockQty"
                          type="number"
                          min="0"
                          defaultValue={supply.stockQty}
                          className="mt-1 w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="min-w-0 text-xs font-semibold text-slate-600">
                        Low
                        <input
                          name="lowStockThreshold"
                          type="number"
                          min="0"
                          defaultValue={supply.lowStockThreshold}
                          className="mt-1 w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                      </label>
                      <button
                        type="submit"
                        className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 sm:col-span-2"
                      >
                        Save stock
                      </button>
                    </form>

                    <form
                      action={adjustSupplyInventory}
                      className="mt-3 grid min-w-0 grid-cols-1 gap-2 rounded-lg border border-emerald-100 bg-white p-3 sm:grid-cols-2"
                    >
                      <input type="hidden" name="supplyId" value={supply.id} />
                      <input type="hidden" name="direction" value="restock" />
                      <input
                        name="quantity"
                        type="number"
                        min="1"
                        placeholder="Qty"
                        className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                      <input
                        name="note"
                        type="text"
                        placeholder="Note"
                        className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                      <button
                        type="submit"
                        className="rounded-lg border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 sm:col-span-2"
                      >
                        Restock
                      </button>
                    </form>

                    <form
                      action={adjustSupplyInventory}
                      className="mt-3 grid min-w-0 grid-cols-1 gap-2 rounded-lg border border-red-100 bg-white p-3 sm:grid-cols-2"
                    >
                      <input type="hidden" name="supplyId" value={supply.id} />
                      <input type="hidden" name="direction" value="taken" />
                      <input
                        name="quantity"
                        type="number"
                        min="1"
                        placeholder="Qty"
                        className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                      <input
                        name="note"
                        type="text"
                        placeholder="Note"
                        className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                      <button
                        type="submit"
                        className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 sm:col-span-2"
                      >
                        Taken / Used
                      </button>
                    </form>
                  </article>
                );
              })
            )}
          </div>

          <div className="mt-4 hidden overflow-x-auto xl:block">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-3 py-2 font-semibold">Item</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Set Stock</th>
                  <th className="px-3 py-2 font-semibold">Restock</th>
                  <th className="px-3 py-2 font-semibold">Taken / Used</th>
                </tr>
              </thead>
              <tbody>
                {supplies.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-6 text-center text-slate-500"
                    >
                      No internal supplies created yet.
                    </td>
                  </tr>
                ) : (
                  supplies.map((supply) => {
                    // Recomputes status from stock values so the table reflects current data.
                    const status = getInventoryAlertStatus(
                      supply.stockQty,
                      supply.lowStockThreshold,
                    );

                    return (
                      <tr
                        key={supply.id}
                        className="border-b border-slate-100 align-top"
                      >
                        <td className="px-3 py-3">
                          <p className="font-semibold text-slate-800">
                            {supply.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {supply.stockQty} {supply.unit} on hand
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${getStatusClasses(status)}`}
                          >
                            {status}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <form
                            action={updateSupplyInventory}
                            className="flex min-w-[300px] flex-wrap items-end gap-2"
                          >
                            <input
                              type="hidden"
                              name="supplyId"
                              value={supply.id}
                            />
                            <label className="text-xs font-semibold text-slate-600">
                              Stock
                              <input
                                name="stockQty"
                                type="number"
                                min="0"
                                defaultValue={supply.stockQty}
                                className="mt-1 w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                              />
                            </label>
                            <label className="text-xs font-semibold text-slate-600">
                              Low
                              <input
                                name="lowStockThreshold"
                                type="number"
                                min="0"
                                defaultValue={supply.lowStockThreshold}
                                className="mt-1 w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                              />
                            </label>
                            <button
                              type="submit"
                              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                            >
                              Save
                            </button>
                          </form>
                        </td>
                        <td className="px-3 py-3">
                          <form
                            action={adjustSupplyInventory}
                            className="flex min-w-[280px] flex-wrap items-end gap-2"
                          >
                            <input
                              type="hidden"
                              name="supplyId"
                              value={supply.id}
                            />
                            <input type="hidden" name="direction" value="restock" />
                            <input
                              name="quantity"
                              type="number"
                              min="1"
                              placeholder="Qty"
                              className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            />
                            <input
                              name="note"
                              type="text"
                              placeholder="Note"
                              className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            />
                            <button
                              type="submit"
                              className="rounded-lg border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                            >
                              Restock
                            </button>
                          </form>
                        </td>
                        <td className="px-3 py-3">
                          <form
                            action={adjustSupplyInventory}
                            className="flex min-w-[280px] flex-wrap items-end gap-2"
                          >
                            <input
                              type="hidden"
                              name="supplyId"
                              value={supply.id}
                            />
                            <input type="hidden" name="direction" value="taken" />
                            <input
                              name="quantity"
                              type="number"
                              min="1"
                              placeholder="Qty"
                              className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            />
                            <input
                              name="note"
                              type="text"
                              placeholder="Note"
                              className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            />
                            <button
                              type="submit"
                              className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                            >
                              Taken
                            </button>
                          </form>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-800">Taken Today</h2>
              <span className="text-sm text-slate-500">
                Since 12:00 AM EAT
              </span>
            </div>

            <div className="mt-3 space-y-2 sm:hidden">
              {takenSummary.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                  No supplies taken today.
                </div>
              ) : (
                takenSummary.map((item) => (
                  <div
                    key={item.itemName}
                    className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                  >
                    <p className="min-w-0 break-words text-sm font-semibold text-slate-700">
                      {item.itemName}
                    </p>
                    <p className="shrink-0 text-sm font-bold text-red-700">
                      {item.quantity}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="mt-3 hidden overflow-x-auto sm:block">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="px-3 py-2 font-semibold">Item</th>
                    <th className="px-3 py-2 font-semibold">Taken</th>
                  </tr>
                </thead>
                <tbody>
                  {takenSummary.length === 0 ? (
                    <tr>
                      <td
                        colSpan={2}
                        className="px-3 py-6 text-center text-slate-500"
                      >
                        No supplies taken today.
                      </td>
                    </tr>
                  ) : (
                    takenSummary.map((item) => (
                      <tr key={item.itemName} className="border-b border-slate-100">
                        <td className="px-3 py-2 font-semibold text-slate-700">
                          {item.itemName}
                        </td>
                        <td className="px-3 py-2 font-bold text-red-700">
                          {item.quantity}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-800">
                Recent Supply Movements
              </h2>
              <span className="text-sm text-slate-500">
                Last {movements.length}
              </span>
            </div>

            <div className="mt-3 space-y-2 md:hidden">
              {movements.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                  No supply movements yet.
                </div>
              ) : (
                movements.map((movement) => (
                  <div
                    key={movement.id}
                    className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 p-3"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-slate-700">
                          {movement.itemName}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {movement.createdAt.toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            timeZone: "Africa/Nairobi",
                          })}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                          movement.delta < 0
                            ? "bg-red-50 text-red-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {movement.delta > 0 ? "+" : ""}
                        {movement.delta}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <div className="min-w-0 rounded-lg bg-white px-2 py-1.5">
                        <p className="font-semibold uppercase text-slate-400">
                          Reason
                        </p>
                        <p className="break-words">{movement.reason}</p>
                      </div>
                      <div className="min-w-0 rounded-lg bg-white px-2 py-1.5">
                        <p className="font-semibold uppercase text-slate-400">
                          After
                        </p>
                        <p>{movement.quantityAfter}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-3 hidden overflow-x-auto md:block">
              <table className="min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="px-3 py-2 font-semibold">Time</th>
                    <th className="px-3 py-2 font-semibold">Item</th>
                    <th className="px-3 py-2 font-semibold">Reason</th>
                    <th className="px-3 py-2 font-semibold">Change</th>
                    <th className="px-3 py-2 font-semibold">After</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-6 text-center text-slate-500"
                      >
                        No supply movements yet.
                      </td>
                    </tr>
                  ) : (
                    movements.map((movement) => (
                      <tr key={movement.id} className="border-b border-slate-100">
                        <td className="px-3 py-2 text-slate-500">
                          {movement.createdAt.toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            timeZone: "Africa/Nairobi",
                          })}
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-700">
                          {movement.itemName}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {movement.reason}
                        </td>
                        <td
                          className={`px-3 py-2 font-bold ${
                            movement.delta < 0
                              ? "text-red-700"
                              : "text-emerald-700"
                          }`}
                        >
                          {movement.delta > 0 ? "+" : ""}
                          {movement.delta}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {movement.quantityAfter}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
