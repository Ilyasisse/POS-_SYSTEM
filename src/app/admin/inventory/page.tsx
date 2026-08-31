import { Input } from "@/components/ui/input";
import {
  Button,
  Card,
  AdminPage,
  SearchToolbar,
  MetricCard,
  Table,
  DataTableCard,
  TableCell,
  TableHead,
  ToneBadge,
} from "@/components/admin/shared";
import AutoSubmitSelect from "@/components/AutoSubmitSelect";
import { ToastOnMount, type ToastTone } from "@/components/ui/toast";
import { prisma } from "@/lib/prisma";
import { normalizeFilterChoice } from "@/lib/admin/admin-filters";
import { getInventoryAlertStatus } from "@/lib/inventory/inventory";
import { canonicalUnitLabel } from "@/lib/inventory/inventory-domain";
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

type InventoryStatus = "OK" | "LOW" | "OUT";

type InventorySupplyRow = {
  id: string;
  name: string;
  stockQty: number;
  unit: string;
  canonicalUnit: "GRAM" | "MILLILITRE" | "PIECE" | null;
  quantityCoverage: "COMPLETE" | "LEGACY_INCOMPLETE" | "MISSING_COST";
  lowStockThreshold: number;
  status: InventoryStatus;
};

type InventoryMovementRow = {
  id: string;
  itemName: string;
  reason: string;
  delta: number;
  createdAt: Date;
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

function addStatus(summary: StatusSummary, status: InventoryStatus) {
  if (status === "OUT") {
    summary.out += 1;
  } else if (status === "LOW") {
    summary.low += 1;
  } else {
    summary.ok += 1;
  }
}

function getTone(status: InventoryStatus) {
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

function InventorySummary({
  summary,
  takenTodayCount,
}: {
  summary: StatusSummary;
  takenTodayCount: number;
}) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="In Stock"
        value={summary.ok}
        helper="Healthy supplies"
      />
      <MetricCard
        label="Low Stock"
        value={summary.low}
        helper="Needs attention"
      />
      <MetricCard
        label="Out of Stock"
        value={summary.out}
        helper="Restock now"
      />
      <MetricCard
        label="Taken Today"
        value={takenTodayCount}
        helper="Since 12:00 AM EAT"
      />
    </section>
  );
}

function CreateSupplyForm() {
  return (
    <Card className="p-4">
      <form
        action={createSupply}
        className="grid gap-3 lg:grid-cols-[1fr_0.5fr_0.4fr_0.4fr_auto]"
      >
        <Input
          aria-label="Supply name"
          name="name"
          type="text"
          placeholder="Item name"
          className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
          required
        />
        <Input
          aria-label="Supply unit"
          name="unit"
          type="text"
          placeholder="Unit"
          className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
        />
        <Input
          aria-label="Initial stock quantity"
          name="stockQty"
          type="number"
          min="0"
          step="0.001"
          placeholder="Stock"
          className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
        />
        <Input
          aria-label="Low stock threshold"
          name="lowStockThreshold"
          type="number"
          min="0"
          step="0.001"
          placeholder="Low"
          className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
        />
        <Button type="submit">Add Supply</Button>
      </form>
    </Card>
  );
}

function InventorySuppliesTable({
  visibleSupplies,
  totalSupplies,
  searchQuery,
  statusFilter,
}: {
  visibleSupplies: InventorySupplyRow[];
  totalSupplies: number;
  searchQuery: string;
  statusFilter: string;
}) {
  return (
    <DataTableCard
      footer={
        <p className="text-sm font-medium text-slate-500">
          Showing 1 to {visibleSupplies.length} of {totalSupplies} items
        </p>
      }
    >
      <SearchToolbar
        placeholder="Search inventory..."
        defaultValue={searchQuery}
        hasActiveFilters={Boolean(searchQuery || statusFilter !== "all")}
        clearHref="/admin/inventory"
      >
        <AutoSubmitSelect name="status" defaultValue={statusFilter}>
          <option value="all">Status All</option>
          <option value="ok">In Stock</option>
          <option value="low">Low Stock</option>
          <option value="out">Out of Stock</option>
        </AutoSubmitSelect>
      </SearchToolbar>
      <Table>
        <thead>
          <tr>
            <TableHead>#</TableHead>
            <TableHead>Item</TableHead>
            <TableHead>Stock</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Set Stock</TableHead>
            <TableHead>Restock</TableHead>
          </tr>
        </thead>
        <tbody>
          {visibleSupplies.length === 0 ? (
            <tr>
              <TableCell colSpan={7} className="py-10 text-center">
                No inventory supplies found.
              </TableCell>
            </tr>
          ) : (
            visibleSupplies.map((supply, index) => (
              <InventorySupplyTableRow
                key={supply.id}
                supply={supply}
                rowNumber={index + 1}
              />
            ))
          )}
        </tbody>
      </Table>
    </DataTableCard>
  );
}

function InventorySupplyTableRow({
  supply,
  rowNumber,
}: {
  supply: InventorySupplyRow;
  rowNumber: number;
}) {
  return (
    <tr className="border-b border-slate-50 align-top">
      <TableCell className="font-bold text-slate-400">{rowNumber}</TableCell>
      <TableCell className="font-black text-slate-950">{supply.name}</TableCell>
      <TableCell>{supply.stockQty}</TableCell>
      <TableCell>
        {canonicalUnitLabel(supply.canonicalUnit)}
        {supply.quantityCoverage !== "COMPLETE" ? " (mapping required)" : ""}
      </TableCell>
      <TableCell>
        <ToneBadge tone={getTone(supply.status)}>
          {supply.status === "OK" ? "In Stock" : supply.status}
        </ToneBadge>
      </TableCell>
      <TableCell>
        <form action={updateSupplyInventory} className="flex min-w-60 gap-2">
          <Input type="hidden" name="supplyId" value={supply.id} />
          <Input
            name="stockQty"
            aria-label={`Stock quantity for ${supply.name}`}
            type="number"
            min="0"
            step="0.001"
            defaultValue={supply.stockQty}
            className="h-9 w-20 rounded-lg border border-slate-200 px-2 text-sm"
          />
          <Input
            name="lowStockThreshold"
            aria-label={`Low stock threshold for ${supply.name}`}
            type="number"
            min="0"
            step="0.001"
            defaultValue={supply.lowStockThreshold}
            className="h-9 w-20 rounded-lg border border-slate-200 px-2 text-sm"
          />
          <Button
            type="submit"
            className="h-9 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white"
          >
            Save
          </Button>
        </form>
      </TableCell>
      <TableCell>
        <form action={adjustSupplyInventory} className="flex min-w-56 gap-2">
          <Input type="hidden" name="supplyId" value={supply.id} />
          <Input
            name="quantity"
            aria-label={`Restock quantity for ${supply.name}`}
            type="number"
            min="1"
            placeholder="Qty"
            className="h-9 w-20 rounded-lg border border-slate-200 px-2 text-sm"
          />
          <Input
            name="note"
            aria-label={`Restock note for ${supply.name}`}
            type="text"
            placeholder="Note"
            className="h-9 w-24 rounded-lg border border-slate-200 px-2 text-sm"
          />
          <Button
            type="submit"
            className="h-9 rounded-lg border border-emerald-200 bg-emerald-900 px-3 text-xs font-bold text-white"
          >
            Add
          </Button>
        </form>
      </TableCell>
    </tr>
  );
}

function RecentInventoryActivity({
  movements,
}: {
  movements: InventoryMovementRow[];
}) {
  return (
    <Card className="p-5">
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
                  {movement.reason} ~ {formatDateTime(movement.createdAt)}
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
    </Card>
  );
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
