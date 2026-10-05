import {
  AdminPage,
} from "@/components/admin/shared";
import { ToastOnMount, type ToastTone } from "@/components/ui/toast";
import { prisma } from "@/lib/prisma";
import { normalizeFilterChoice } from "@/lib/admin/admin-filters";
import { getInventoryAlertStatus } from "@/lib/inventory/inventory";
import {
  AdminInventoryPageProps,
  InventoryStatus,
  StatusSummary,
} from "@/types/admin/Inventory.types";
import CreateSupplyForm from "./_compoents/CreateSupplyForm";
import InventorySummary from "./_compoents/InventorySummary";
import InventorySuppliesTable from "./_compoents/InventorySuppliesTable";
import RecentInventoryActivity from "./_compoents/RecentInventoryActitvity";
import { getEatDayStart } from "@/app/inventory/page";
const EAT_OFFSET_HOURS = 3;



function addStatus(summary: StatusSummary, status: InventoryStatus) {
  if (status === "OUT") {
    summary.out += 1;
  } else if (status === "LOW") {
    summary.low += 1;
  } else {
    summary.ok += 1;
  }
}



function getInventoryEmailMessage(
  value?: string,
): { tone: ToastTone; message: string } | null {
  if (value === "sent")
    return { tone: "success", message: "Inventory email sent." };
  if (value === "failed")
    return { tone: "error", message: "Inventory email failed." };
  if (value === "skipped")
    return { tone: "warning", message: "Inventory email skipped." };
  if (value === "none")
    return { tone: "info", message: "No inventory email needed." };
  return null;
}

function InventoryNotice({
  notice,
}: {
  notice: { tone: ToastTone; message: string } | null;
}) {
  if (!notice) {
    return null;
  }

  return <ToastOnMount tone={notice.tone} description={notice.message} />;
}

export default async function AdminInventoryPage({
  searchParams,
}: AdminInventoryPageProps) {
  const params = await searchParams;
  const q = params?.q?.trim().toLowerCase() ?? "";
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

  const enrichedSupplies = supplies.map((supply) => ({
    ...supply,
    stockQty: Number(supply.stockQty),
    lowStockThreshold: Number(supply.lowStockThreshold),
    status: getInventoryAlertStatus(
      Number(supply.stockQty),
      Number(supply.lowStockThreshold),
    ),
  }));
  const visibleSupplies = enrichedSupplies.filter((supply) => {
    const matchesSearch = !q || supply.name.toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === "all" || supply.status.toLowerCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });
  const summary = enrichedSupplies.reduce<StatusSummary>(
    (accumulator, supply) => {
      addStatus(accumulator, supply.status);
      return accumulator;
    },
    { ok: 0, low: 0, out: 0 },
  );

  return (
    <AdminPage
      title="Inventory"
      description="Track stock levels and manage inventory"
    >
      <InventoryNotice notice={notice} />
      <InventorySummary
        summary={summary}
        takenTodayCount={takenTodayMovements.length}
      />
      <CreateSupplyForm />
      <InventorySuppliesTable
        visibleSupplies={visibleSupplies}
        totalSupplies={enrichedSupplies.length}
        searchQuery={params?.q ?? ""}
        statusFilter={statusFilter}
      />
      <RecentInventoryActivity
        movements={movements.map((movement) => ({
          ...movement,
          delta: Number(movement.delta),
        }))}
      />
    </AdminPage>
  );
}
