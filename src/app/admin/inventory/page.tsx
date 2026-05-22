import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getInventoryAlertStatus } from "@/lib/inventory";
import {
  adjustSupplyInventory,
  createSupply,
  updateSupplyInventory,
} from "./actions";

type StatusSummary = {
  ok: number;
  low: number;
  out: number;
};

type TakenSummary = {
  itemName: string;
  quantity: number;
};

const EAT_OFFSET_HOURS = 3;

function getEatDayStart(date = new Date()) {
  const eatNow = new Date(date.getTime() + EAT_OFFSET_HOURS * 60 * 60 * 1000);
  const eatStart = Date.UTC(
    eatNow.getUTCFullYear(),
    eatNow.getUTCMonth(),
    eatNow.getUTCDate(),
  );

  return new Date(eatStart - EAT_OFFSET_HOURS * 60 * 60 * 1000);
}

function getStatusClasses(status: "OK" | "LOW" | "OUT") {
  if (status === "OUT") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (status === "LOW") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  return "bg-emerald-50 text-emerald-700 ring-emerald-200";
}

function addStatus(summary: StatusSummary, status: "OK" | "LOW" | "OUT") {
  if (status === "OUT") {
    summary.out += 1;
  } else if (status === "LOW") {
    summary.low += 1;
  } else {
    summary.ok += 1;
  }
}

function summarizeTakenToday(
  movements: Array<{ itemName: string; delta: number }>,
) {
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

export default async function AdminInventoryPage() {
  const todayStart = getEatDayStart();
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
  const takenSummary = summarizeTakenToday(takenTodayMovements);

  return (
    <main
      className="min-h-screen bg-linear-to-br from-slate-100 via-slate-50 to-blue-50 px-4 py-6 text-slate-900 md:px-6"
      style={{ fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif' }}
    >
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
            <form action={createSupply} className="flex flex-wrap gap-2">
              <input
                name="name"
                type="text"
                placeholder="Item name"
                className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              />
              <input
                name="unit"
                type="text"
                placeholder="Unit"
                className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                name="stockQty"
                type="number"
                min="0"
                placeholder="Stock"
                className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                name="lowStockThreshold"
                type="number"
                min="0"
                placeholder="Low"
                className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Create
              </button>
            </form>
          </div>

          <div className="mt-3 overflow-x-auto">
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

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-800">Taken Today</h2>
              <span className="text-sm text-slate-500">
                Since 12:00 AM EAT
              </span>
            </div>

            <div className="mt-3 overflow-x-auto">
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
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-800">
                Recent Supply Movements
              </h2>
              <span className="text-sm text-slate-500">
                Last {movements.length}
              </span>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
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
