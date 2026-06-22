import {
  AdminButton,
  AdminCard,
  AdminPageFrame,
  AdminSearchToolbar,
  AdminSelect,
  AdminStatCard,
  AdminTable,
  AdminTableShell,
  AdminTd,
  AdminTh,
  ToneBadge,
} from "@/components/admin/AdminUi";
import { prisma } from "@/lib/prisma";
import { getInventoryAlertStatus } from "@/lib/inventory/inventory";
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

type AdminInventoryPageProps = {
  searchParams?: Promise<{
    inventoryEmail?: string;
    q?: string;
    status?: string;
  }>;
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

function addStatus(summary: StatusSummary, status: "OK" | "LOW" | "OUT") {
  if (status === "OUT") {
    summary.out += 1;
  } else if (status === "LOW") {
    summary.low += 1;
  } else {
    summary.ok += 1;
  }
}

function getTone(status: "OK" | "LOW" | "OUT") {
  if (status === "OUT") {
    return "red" as const;
  }

  if (status === "LOW") {
    return "amber" as const;
  }

  return "green" as const;
}

function formatDateTime(date: Date) {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Nairobi",
  });
}

function getInventoryEmailMessage(value?: string) {
  if (value === "sent") return "Inventory email sent.";
  if (value === "failed") return "Inventory email failed.";
  if (value === "skipped") return "Inventory email skipped.";
  if (value === "none") return "No inventory email needed.";
  return null;
}

export default async function AdminInventoryPage({
  searchParams,
}: AdminInventoryPageProps) {
  const params = await searchParams;
  const q = params?.q?.trim().toLowerCase() ?? "";
  const statusFilter = params?.status ?? "all";
  const todayStart = getEatDayStart();
  const notice = getInventoryEmailMessage(params?.inventoryEmail);

  const [supplies, movements, takenTodayMovements] = await prisma.$transaction([
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
    status: getInventoryAlertStatus(supply.stockQty, supply.lowStockThreshold),
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
    <AdminPageFrame
      title="Inventory"
      description="Track stock levels and manage inventory"
    >
      {notice ? (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
          {notice}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="In Stock"
          value={summary.ok}
          helper="Healthy supplies"
        />
        <AdminStatCard
          label="Low Stock"
          value={summary.low}
          helper="Needs attention"
        />
        <AdminStatCard
          label="Out of Stock"
          value={summary.out}
          helper="Restock now"
        />
        <AdminStatCard
          label="Taken Today"
          value={takenTodayMovements.length}
          helper="Since 12:00 AM EAT"
        />
      </section>

      <AdminCard className="p-4">
        <form
          action={createSupply}
          className="grid gap-3 lg:grid-cols-[1fr_0.5fr_0.4fr_0.4fr_auto]"
        >
          <input
            aria-label="Supply name"
            name="name"
            type="text"
            placeholder="Item name"
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            required
          />
          <input
            aria-label="Supply unit"
            name="unit"
            type="text"
            placeholder="Unit"
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
          />
          <input
            aria-label="Initial stock quantity"
            name="stockQty"
            type="number"
            min="0"
            placeholder="Stock"
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
          />
          <input
            aria-label="Low stock threshold"
            name="lowStockThreshold"
            type="number"
            min="0"
            placeholder="Low"
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
          />
          <AdminButton type="submit">Add Supply</AdminButton>
        </form>
      </AdminCard>

      <AdminTableShell
        footer={
          <p className="text-sm font-medium text-slate-500">
            Showing 1 to {visibleSupplies.length} of {enrichedSupplies.length}{" "}
            items
          </p>
        }
      >
        <AdminSearchToolbar
          placeholder="Search inventory..."
          defaultValue={params?.q ?? ""}
        >
          <AdminSelect name="status" defaultValue={statusFilter}>
            <option value="all">Category All</option>
            <option value="ok">In Stock</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </AdminSelect>
          <button
            type="submit"
            className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            Filter
          </button>
        </AdminSearchToolbar>
        <AdminTable>
          <thead>
            <tr>
              <AdminTh>#</AdminTh>
              <AdminTh>Item</AdminTh>
              <AdminTh>Stock</AdminTh>
              <AdminTh>Unit</AdminTh>
              <AdminTh>Status</AdminTh>
              <AdminTh>Set Stock</AdminTh>
              <AdminTh>Restock</AdminTh>
            </tr>
          </thead>
          <tbody>
            {visibleSupplies.length === 0 ? (
              <tr>
                <AdminTd colSpan={7} className="py-10 text-center">
                  No inventory supplies found.
                </AdminTd>
              </tr>
            ) : (
              visibleSupplies.map((supply, index) => (
                <tr
                  key={supply.id}
                  className="border-b border-slate-50 align-top"
                >
                  <AdminTd className="font-bold text-slate-400">
                    {index + 1}
                  </AdminTd>
                  <AdminTd className="font-black text-slate-950">
                    {supply.name}
                  </AdminTd>
                  <AdminTd>{supply.stockQty}</AdminTd>
                  <AdminTd>{supply.unit}</AdminTd>
                  <AdminTd>
                    <ToneBadge tone={getTone(supply.status)}>
                      {supply.status === "OK" ? "In Stock" : supply.status}
                    </ToneBadge>
                  </AdminTd>
                  <AdminTd>
                    <form
                      action={updateSupplyInventory}
                      className="flex min-w-60 gap-2"
                    >
                      <input type="hidden" name="supplyId" value={supply.id} />
                      <input
                        name="stockQty"
                        aria-label={`Stock quantity for ${supply.name}`}
                        type="number"
                        min="0"
                        defaultValue={supply.stockQty}
                        className="h-9 w-20 rounded-lg border border-slate-200 px-2 text-sm"
                      />
                      <input
                        name="lowStockThreshold"
                        aria-label={`Low stock threshold for ${supply.name}`}
                        type="number"
                        min="0"
                        defaultValue={supply.lowStockThreshold}
                        className="h-9 w-20 rounded-lg border border-slate-200 px-2 text-sm"
                      />
                      <button
                        type="submit"
                        className="h-9 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white"
                      >
                        Save
                      </button>
                    </form>
                  </AdminTd>
                  <AdminTd>
                    <form
                      action={adjustSupplyInventory}
                      className="flex min-w-56 gap-2"
                    >
                      <input type="hidden" name="supplyId" value={supply.id} />
                      <input
                        name="quantity"
                        aria-label={`Restock quantity for ${supply.name}`}
                        type="number"
                        min="1"
                        placeholder="Qty"
                        className="h-9 w-20 rounded-lg border border-slate-200 px-2 text-sm"
                      />
                      <input
                        name="note"
                        aria-label={`Restock note for ${supply.name}`}
                        type="text"
                        placeholder="Note"
                        className="h-9 w-24 rounded-lg border border-slate-200 px-2 text-sm"
                      />
                      <button
                        type="submit"
                        className="h-9 rounded-lg border border-emerald-200 px-3 text-xs font-bold text-emerald-700"
                      >
                        Add
                      </button>
                    </form>
                  </AdminTd>
                </tr>
              ))
            )}
          </tbody>
        </AdminTable>
      </AdminTableShell>

      <AdminCard className="p-5">
        <h2 className="text-lg font-black text-slate-950">
          Recent Inventory Activity
        </h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {movements.length === 0 ? (
            <p className="text-sm font-medium text-slate-500">
              No supply movements yet.
            </p>
          ) : (
            movements.map((movement) => (
              <div
                key={movement.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-950">
                    {movement.itemName}
                  </p>
                  <p className="text-xs font-medium text-slate-500">
                    {movement.reason} · {formatDateTime(movement.createdAt)}
                  </p>
                </div>
                <ToneBadge tone={movement.delta < 0 ? "red" : "green"}>
                  {movement.delta > 0 ? "+" : ""}
                  {movement.delta}
                </ToneBadge>
              </div>
            ))
          )}
        </div>
      </AdminCard>
    </AdminPageFrame>
  );
}
