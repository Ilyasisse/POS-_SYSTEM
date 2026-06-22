import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import { requireRole } from "@/lib/auth/require-role";
import { getInventoryAlertStatus } from "@/lib/inventory/inventory";
import { prisma } from "@/lib/prisma";
import { takeSupplyInventory } from "./actions";

type StatusSummary = {
  ok: number;
  low: number;
  out: number;
};

type InventoryPageProps = {
  searchParams?: Promise<{
    inventoryEmail?: string;
  }>;
};

type InventoryEmailStatus = "sent" | "failed" | "skipped" | "none";

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

function getStatusLabel(status: "OK" | "LOW" | "OUT") {
  if (status === "OUT") {
    return "Out";
  }

  if (status === "LOW") {
    return "Low";
  }

  return "OK";
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

function InventoryEmailPopup({ status }: { status: InventoryEmailStatus }) {
  const config = {
    sent: {
      title: "Inventory email sent",
      message: "The low-stock email was accepted.",
      classes: "border-emerald-200 bg-emerald-50 text-emerald-900",
    },
    failed: {
      title: "Inventory email failed",
      message: "The alert was not sent. Check the server logs.",
      classes: "border-red-200 bg-red-50 text-red-900",
    },
    skipped: {
      title: "Inventory email skipped",
      message: "Email settings are missing on the server.",
      classes: "border-amber-200 bg-amber-50 text-amber-900",
    },
    none: {
      title: "No inventory email needed",
      message: "The stock change did not create a new alert.",
      classes: "border-slate-200 bg-white text-slate-900",
    },
  }[status];

  return (
    <output
      className={`fixed right-4 top-4 z-50 w-[min(360px,calc(100vw-2rem))] rounded-xl border p-4 shadow-xl ${config.classes}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold">{config.title}</p>
          <p className="mt-1 text-sm">{config.message}</p>
        </div>
        <Link
          href="/inventory"
          className="rounded-md px-2 py-1 text-sm font-bold hover:bg-black/5"
          aria-label="Dismiss inventory email message"
        >
          x
        </Link>
      </div>
    </output>
  );
}

export default async function InventoryPage({
  searchParams,
}: InventoryPageProps) {
  const todayStart = getEatDayStart();

  const [currentUser, params, [supplies, takenTodayMovements]] =
    await Promise.all([
      requireRole(["ADMIN", "Cabitaan"], ["CABITAAN"]),
      searchParams,
      Promise.all([
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
            delta: {
              lt: 0,
            },
            createdAt: {
              gte: todayStart,
            },
          },
          take: 12,
          orderBy: {
            createdAt: "desc",
          },
        }),
      ]),
    ]);
  const inventoryEmailStatus = getInventoryEmailStatus(params?.inventoryEmail);

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

  return (
    <main
      className="min-h-screen bg-linear-to-br from-slate-100 via-slate-50 to-emerald-50 px-4 py-6 text-slate-900 md:px-6"
      style={{ fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif' }}
    >
      {inventoryEmailStatus ? (
        <InventoryEmailPopup status={inventoryEmailStatus} />
      ) : null}

      <div className="mx-auto w-full max-w-7xl space-y-4 pb-24">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Inventory Use
            </p>
            <h1 className="text-2xl font-bold">Take Internal Supplies</h1>
            <p className="text-sm text-slate-500">
              Record supplies taken out during service. Restocking stays in
              admin.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Signed in
              </p>
              <p className="text-sm font-semibold text-slate-800">
                {currentUser.fullName}
              </p>
            </div>
            <Link
              href="/kitchen/cabitaan"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back
            </Link>
            <SignOutButton />
          </div>
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

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  Internal Supplies
                </h2>
                <p className="text-sm text-slate-500">
                  Enter a quantity to subtract it from stock.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {supplies.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 md:col-span-2 2xl:col-span-3">
                  No internal supplies created yet.
                </div>
              ) : (
                supplies.map((supply) => {
                  const status = getInventoryAlertStatus(
                    supply.stockQty,
                    supply.lowStockThreshold,
                  );
                  const isOut = status === "OUT";

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
                          {getStatusLabel(status)}
                        </span>
                      </div>

                      <form
                        action={takeSupplyInventory}
                        className="mt-4 grid min-w-0 grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[96px_minmax(0,1fr)]"
                      >
                        <input type="hidden" name="supplyId" value={supply.id} />
                        <label className="min-w-0 text-xs font-semibold text-slate-600">
                          Quantity
                          <input
                            name="quantity"
                            type="number"
                            inputMode="numeric"
                            min="1"
                            step="1"
                            placeholder="0"
                            disabled={isOut}
                            required
                            className="mt-1 w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                          />
                        </label>
                        <label className="min-w-0 text-xs font-semibold text-slate-600">
                          Note
                          <input
                            name="note"
                            type="text"
                            placeholder="Optional"
                            disabled={isOut}
                            className="mt-1 w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={isOut}
                          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:col-span-2"
                        >
                          {isOut ? "Out of stock" : "Take out"}
                        </button>
                      </form>
                    </article>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-800">
                Recent Taken
              </h2>
              <span className="text-sm text-slate-500">Today</span>
            </div>

            <div className="mt-3 space-y-2">
              {takenTodayMovements.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                  No supplies taken today.
                </div>
              ) : (
                takenTodayMovements.map((movement) => (
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
                      <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
                        {movement.delta}
                      </span>
                    </div>
                    {movement.note ? (
                      <p className="mt-2 break-words text-xs text-slate-500">
                        {movement.note}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
