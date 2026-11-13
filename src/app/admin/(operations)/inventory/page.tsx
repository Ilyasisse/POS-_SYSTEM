import { AdminPage } from "@/components/admin/shared";
import { ToastOnMount, type ToastTone } from "@/components/ui/toast";
import { prisma } from "@/lib/prisma";
import { normalizeFilterChoice } from "@/lib/admin/admin-filters";
import { getInventoryAlertStatus } from "@/lib/inventory/inventory";
import {
  supplyDisplayQuantity,
  supplyMovementDisplay,
  supplyStockUnit,
} from "@/lib/inventory/supply-units";
import {
  AdminInventoryPageProps,
  InventoryStatus,
  StatusSummary,
} from "@/types/admin/Inventory.types";
import { adjustSupplyInventory, updateSupplyInventory } from "./actions";
import CreateSupplyForm from "./_compoents/CreateSupplyForm";
import InventorySummary from "./_compoents/InventorySummary";
import InventorySupplyWorkspace from "./_compoents/InventorySupplyWorkspace";
import RecentInventoryActivity from "./_compoents/RecentInventoryActitvity";
import { getEatDayStart } from "@/app/inventory/page";

function addStatus(summary: StatusSummary, status: InventoryStatus) {
  if (status === "OUT") {
    summary.out += 1;
  } else if (status === "LOW") {
    summary.low += 1;
  } else {
    summary.ok += 1;
  }
}

function getInventoryEmailMessage(value?: string): { tone: ToastTone; message: string } | null {
  if (value === "sent") return { tone: "success", message: "Inventory email sent." };
  if (value === "failed") return { tone: "error", message: "Inventory email failed." };
  if (value === "skipped") return { tone: "warning", message: "Inventory email skipped." };
  if (value === "none") return { tone: "info", message: "No inventory email needed." };
  return null;
}

function InventoryNotice({ notice }: { notice: { tone: ToastTone; message: string } | null }) {
  if (!notice) {
    return null;
  }

  return <ToastOnMount tone={notice.tone} description={notice.message} />;
}

export default async function AdminInventoryPage({ searchParams }: AdminInventoryPageProps) {
  const params = await searchParams;
  const statusFilter = normalizeFilterChoice(
    params?.status,
    ["all", "ok", "low", "out"] as const,
    "all",
  );
  const todayStart = getEatDayStart();
  const notice = getInventoryEmailMessage(params?.inventoryEmail);

  const [supplies, movements, takenTodayMovements] = await Promise.all([
    prisma.inventorySupply.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
    prisma.inventoryMovement.findMany({
      where: {
        itemType: "Supply",
        supplyId: {
          not: null,
        },
      },
      include: { supply: { select: { unit: true } } },
      take: 8,
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
      select: {
        id: true,
        itemName: true,
        delta: true,
      },
    }),
  ]);

  const enrichedSupplies = supplies.map((supply) => {
    const stockUnit = supplyStockUnit(supply);
    return {
      id: supply.id,
      name: supply.name,
      unit: stockUnit.label,
      stockUnit: stockUnit.token,
      step: stockUnit.step,
      hasUnitMapping: supply.canonicalUnit !== null,
      stockQty: supplyDisplayQuantity(supply.stockQty, stockUnit.factor),
      lowStockThreshold: supplyDisplayQuantity(supply.lowStockThreshold, stockUnit.factor),
      status: getInventoryAlertStatus(supply.stockQty, supply.lowStockThreshold),
    };
  });
  const summary = enrichedSupplies.reduce<StatusSummary>(
    (accumulator, supply) => {
      addStatus(accumulator, supply.status);
      return accumulator;
    },
    { ok: 0, low: 0, out: 0 },
  );

  return (
    <AdminPage title="Inventory" description="Track stock levels and manage inventory">
      <InventoryNotice notice={notice} />
      <InventorySummary summary={summary} takenTodayCount={takenTodayMovements.length} />
      <CreateSupplyForm />
      <InventorySupplyWorkspace
        key={JSON.stringify([params?.q ?? "", statusFilter])}
        supplies={enrichedSupplies}
        updateStock={updateSupplyInventory}
        restock={adjustSupplyInventory}
        initialSearch={params?.q ?? ""}
        initialFilter={
          { all: "ALL", ok: "OK", low: "LOW", out: "OUT" }[statusFilter] as "ALL" | InventoryStatus
        }
      />
      <RecentInventoryActivity
        movements={movements.map((movement) => {
          const display = supplyMovementDisplay(movement);
          return {
            ...movement,
            itemName: display.name,
            delta: display.quantity,
            unit: display.unit,
          };
        })}
      />
    </AdminPage>
  );
}
