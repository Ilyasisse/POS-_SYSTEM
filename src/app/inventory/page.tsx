import Link from "next/link";
import InventoryDateSelector from "@/components/inventory/InventoryDateSelector";
import { inventoryDateRange } from "@/lib/inventory/movement-date";
import { getTodaySupplyDateKey, resolveSupplyDateKey } from "@/lib/supplies/supply-purchases";
import { bodyFont, displayFont } from "@/components/customer/customer-order-styles";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { getInventoryAlertStatus } from "@/lib/inventory/inventory";
import {
  supplyDisplayQuantity,
  supplyQuantityLabel,
  supplyMovementDisplay,
  supplyStockUnit,
} from "@/lib/inventory/supply-units";
import { prisma } from "@/lib/prisma";
import { takeSupplyInventory } from "./actions";
import InventorySupplyPicker from "./InventorySupplyPicker";

type StatusSummary = {
  ok: number;
  low: number;
  out: number;
};

function addStatus(summary: StatusSummary, status: "OK" | "LOW" | "OUT") {
  if (status === "OUT") {
    summary.out += 1;
  } else if (status === "LOW") {
    summary.low += 1;
  } else {
    summary.ok += 1;
  }
}

export default async function InventoryPage({ searchParams }: {
  searchParams?: Promise<{ date?: string }>;
}) {
  const selectedDate = resolveSupplyDateKey((await searchParams)?.date);
  const today = getTodaySupplyDateKey();
  const dateRange = inventoryDateRange(selectedDate);

  const [user, [supplies, takenMovements, takenCount]] = await Promise.all([
    requirePermission(PERMISSIONS.INVENTORY_VIEW, {
      stations: ["CABITAAN"],
    }),
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
          occurredAt: dateRange,
          reason: "TAKEN",
        },
        include: { supply: { select: { unit: true } } },
        take: 12,
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      }),
      prisma.inventoryMovement.count({ where: {
        itemType: "Supply", supplyId: { not: null }, delta: { lt: 0 },
        reason: "TAKEN", occurredAt: dateRange,
      } }),
    ]),
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

  return (
    <main
      className="text-foreground min-h-dvh bg-[linear-gradient(180deg,#f4eadb_0%,#fffaf3_34%,#e7d1b1_100%)] dark:bg-[linear-gradient(180deg,var(--background)_0%,var(--card)_45%,var(--background)_100%)]"
      style={{ fontFamily: bodyFont }}
    >
      <div className="mx-auto w-full max-w-7xl space-y-4 px-3 py-3 pb-28 sm:px-5 sm:py-5 sm:pb-28 lg:px-8 lg:py-6">
        <header className="border-border bg-card/88 flex flex-wrap items-center justify-between gap-3 rounded-3xl border p-4 shadow-[0_20px_60px_rgba(44,28,17,0.14)] sm:p-5">
          <div>
            <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
              Inventory Use
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl" style={{ fontFamily: displayFont }}>
              Take Internal Supplies
            </h1>
            <p className="text-muted-foreground text-sm">
              Record supplies taken out during service. Manage restocking in admin.
            </p>
          </div>

          <Link
            prefetch={false}
            href="/kitchen/cabitaan"
            className="border-border text-foreground hover:bg-muted rounded-lg border px-3 py-2 text-sm font-semibold"
          >
            Back
          </Link>
        </header>

        <InventoryDateSelector key={`date-selector:${selectedDate}`} date={selectedDate} today={today} />

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="border-border bg-card rounded-2xl border p-4 shadow-lg">
            <p className="text-muted-foreground text-sm font-semibold tracking-[0.14em] uppercase">
              OK
            </p>
            <p className="mt-2 text-3xl font-bold text-emerald-700 dark:text-emerald-300">
              {summary.ok}
            </p>
          </div>
          <div className="border-border bg-card rounded-2xl border p-4 shadow-lg">
            <p className="text-muted-foreground text-sm font-semibold tracking-[0.14em] uppercase">
              Low
            </p>
            <p className="mt-2 text-3xl font-bold text-amber-700 dark:text-amber-300">
              {summary.low}
            </p>
          </div>
          <div className="border-border bg-card rounded-2xl border p-4 shadow-lg">
            <p className="text-muted-foreground text-sm font-semibold tracking-[0.14em] uppercase">
              Out
            </p>
            <p className="mt-2 text-3xl font-bold text-red-700 dark:text-red-300">{summary.out}</p>
          </div>
          <div className="border-border bg-card rounded-2xl border p-4 shadow-lg">
            <p className="text-muted-foreground text-sm font-semibold tracking-[0.14em] uppercase">
              {selectedDate === today ? "Taken Today" : "Taken on selected date"}
            </p>
            <p className="text-foreground mt-2 text-3xl font-bold">{takenCount}</p>
          </div>
        </section>

        <InventorySupplyPicker
          key={`supply-picker:${selectedDate}`}
          movementDate={selectedDate}
          takeSupply={takeSupplyInventory}
          canTake={hasPermission(user, PERMISSIONS.INVENTORY_MANAGE)}
          supplies={supplies.map((supply) => {
            const stockUnit = supplyStockUnit(supply);
            const stockQty = supplyDisplayQuantity(supply.stockQty, stockUnit.factor);
            return {
              id: supply.id,
              name: supply.name,
              unit: stockUnit.label,
              stockUnit: stockUnit.token,
              step: stockUnit.step,
              stockQty,
              stockQtyLabel: supplyQuantityLabel(stockQty, stockUnit.label),
              status: getInventoryAlertStatus(
                supply.stockQty,
                supply.lowStockThreshold,
              ),
              hasUnitMapping: supply.canonicalUnit !== null,
            };
          })}
        />

        <section className="border-border bg-card/88 rounded-3xl border p-4 shadow-[0_22px_65px_rgba(44,28,17,0.12)] sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-foreground text-lg font-bold">Recent Taken</h2>
            <span className="text-muted-foreground text-sm">{selectedDate}</span>
          </div>

          <div className="mt-3 space-y-2">
            {takenMovements.length === 0 ? (
              <div className="border-border text-muted-foreground rounded-xl border border-dashed p-5 text-center text-sm">
                No supplies taken on this date.
              </div>
            ) : (
              takenMovements.map((movement) => {
                const display = supplyMovementDisplay(movement);
                return (
                  <div
                    key={movement.id}
                    className="border-border bg-muted/50 min-w-0 rounded-xl border p-3"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="wrap-break-words text-foreground text-sm font-semibold">
                          {display.name}
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          {movement.occurredAt.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            timeZone: "Africa/Nairobi",
                          })}
                        </p>
                      </div>
                      <span className="max-w-[45%] shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-right text-xs font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300">
                        {supplyQuantityLabel(display.quantity, display.unit)}
                      </span>
                    </div>
                    {movement.note ? (
                      <p className="wrap-break-words text-muted-foreground mt-2 text-xs">
                        {movement.note}
                      </p>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
