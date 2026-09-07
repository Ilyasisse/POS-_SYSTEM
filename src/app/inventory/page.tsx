import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToastOnMount, type ToastTone } from "@/components/ui/toast";
import Link from "next/link";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { getInventoryAlertStatus } from "@/lib/inventory/inventory";
import { canonicalUnitLabel } from "@/lib/inventory/inventory-domain";
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
      tone: "success" as ToastTone,
    },
    failed: {
      title: "Inventory email failed",
      message: "The alert was not sent. Check the server logs.",
      tone: "error" as ToastTone,
    },
    skipped: {
      title: "Inventory email skipped",
      message: "Email settings are missing on the server.",
      tone: "warning" as ToastTone,
    },
    none: {
      title: "No inventory email needed",
      message: "The stock change did not create a new alert.",
      tone: "info" as ToastTone,
    },
  }[status];

  return (
    <ToastOnMount
      tone={config.tone}
      title={config.title}
      description={config.message}
    />
  );
}

export default async function InventoryPage({
  searchParams,
}: InventoryPageProps) {
  const todayStart = getEatDayStart();

  const [, params, [supplies, takenTodayMovements]] =
    await Promise.all([
      requirePermission(PERMISSIONS.INVENTORY_VIEW, {
        stations: ["CABITAAN"],
      }),
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
    getInventoryAlertStatus(Number(supply.stockQty), Number(supply.lowStockThreshold)),
      );
      return accumulator;
    },
    { ok: 0, low: 0, out: 0 },
  );

  return (
    <main
      className="min-h-screen bg-muted/35 px-4 py-6 text-foreground md:px-6"
      style={{ fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif' }}
    >
      {inventoryEmailStatus ? (
        <InventoryEmailPopup status={inventoryEmailStatus} />
      ) : null}

      <div className="mx-auto w-full max-w-7xl space-y-4 pb-24">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-lg">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Inventory Use
            </p>
            <h1 className="text-2xl font-bold">Take Internal Supplies</h1>
            <p className="text-sm text-muted-foreground">
              Record supplies taken out during service. Restocking stays in
              admin.
            </p>
          </div>

          <Link
            href="/kitchen/cabitaan"
            className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
          >
            Back
          </Link>
        </header>

        <section className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-lg">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              OK
            </p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">
              {summary.ok}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-lg">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Low
            </p>
            <p className="mt-2 text-3xl font-bold text-amber-700">
              {summary.low}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-lg">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Out
            </p>
            <p className="mt-2 text-3xl font-bold text-red-700">
              {summary.out}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-lg">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Taken Today
            </p>
            <p className="mt-2 text-3xl font-bold text-foreground">
              {takenTodayMovements.length}
            </p>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-lg">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  Internal Supplies
                </h2>
                <p className="text-sm text-muted-foreground">
                  Enter a quantity to subtract it from stock.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {supplies.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground md:col-span-2 2xl:col-span-3">
                  No internal supplies created yet.
                </div>
              ) : (
                supplies.map((supply) => {
                  const status = getInventoryAlertStatus(
                Number(supply.stockQty),
                Number(supply.lowStockThreshold),
                  );
                  const isOut = status === "OUT";

                  return (
                    <article
                      key={supply.id}
                      className="min-w-0 rounded-xl border border-border bg-muted/50 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="break-words text-base font-bold text-foreground">
                            {supply.name}
                          </h3>
                          <p className="mt-1 text-xs text-muted-foreground">
                        {supply.stockQty.toString()} {canonicalUnitLabel(supply.canonicalUnit)} on hand
                        {supply.quantityCoverage !== "COMPLETE" ? " · unit mapping required" : ""}
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
                        className="mt-4 grid min-w-0 grid-cols-1 gap-2 rounded-lg border border-border bg-card p-3 sm:grid-cols-[96px_minmax(0,1fr)]"
                      >
                        <Input
                          type="hidden"
                          name="supplyId"
                          value={supply.id}
                        />
                        <label
                          htmlFor={`quantity-${supply.id}`}
                          className="min-w-0 text-xs font-semibold text-muted-foreground"
                        >
                          Quantity
                          <Input
                            id={`quantity-${supply.id}`}
                            name="quantity"
                            type="number"
                        inputMode="decimal"
                        min="0.001"
                        step="0.001"
                            placeholder="0"
                            disabled={isOut}
                            required
                            className="mt-1 w-full min-w-0 rounded-lg border border-border px-3 py-2 text-sm disabled:bg-muted"
                          />
                        </label>
                        <label
                          htmlFor={`note-${supply.id}`}
                          className="min-w-0 text-xs font-semibold text-muted-foreground"
                        >
                          Note
                          <Input
                            id={`note-${supply.id}`}
                            name="note"
                            type="text"
                            placeholder="Optional"
                            disabled={isOut}
                            className="mt-1 w-full min-w-0 rounded-lg border border-border px-3 py-2 text-sm disabled:bg-muted"
                          />
                        </label>
                        <Button
                          type="submit"
                          disabled={isOut}
                          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:col-span-2"
                        >
                          {isOut ? "Out of stock" : "Take out"}
                        </Button>
                      </form>
                    </article>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-foreground">
                Recent Taken
              </h2>
              <span className="text-sm text-muted-foreground">Today</span>
            </div>

            <div className="mt-3 space-y-2">
              {takenTodayMovements.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                  No supplies taken today.
                </div>
              ) : (
                takenTodayMovements.map((movement) => (
                  <div
                    key={movement.id}
                    className="min-w-0 rounded-xl border border-border bg-muted/50 p-3"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-foreground">
                          {movement.itemName}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
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
                        {movement.delta.toString()}
                      </span>
                    </div>
                    {movement.note ? (
                      <p className="mt-2 break-words text-xs text-muted-foreground">
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
