import Link from "next/link";
import {
  AdminPage,
  Button,
  Card,
  DataTableCard,
  Table,
  TableCell,
  TableHead,
} from "@/components/admin/shared";
import { ToastOnMount } from "@/components/ui/toast";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { canonicalUnitLabel } from "@/lib/inventory/inventory-domain";
import { quantityToPar } from "@/lib/inventory/par-levels";
import { prisma } from "@/lib/prisma";
import { updateSupplyParLevelAction } from "./actions";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

export default async function SupplyParLevelsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; notice?: string }>;
}) {
  const user = await requirePermission(PERMISSIONS.INVENTORY_VIEW);
  const query = (await searchParams) ?? {};
  const canEdit = hasPermission(user, PERMISSIONS.INVENTORY_MANAGE);
  const [count, configured] = await Promise.all([
    prisma.inventorySupply.count({ where: { isActive: true } }),
    prisma.inventorySupply.count({
      where: { isActive: true, parLevel: { not: null } },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const requested = Number(query.page);
  const page =
    Number.isSafeInteger(requested) && requested > 0
      ? Math.min(requested, pages)
      : 1;
  const supplies = await prisma.inventorySupply.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      unit: true,
      canonicalUnit: true,
      quantityCoverage: true,
      stockQty: true,
      lowStockThreshold: true,
      parLevel: true,
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const notices = {
    saved: { tone: "success" as const, message: "Par target saved." },
    invalid: {
      tone: "error" as const,
      message:
        "Enter a positive par target above the low-stock threshold, or clear it to disable the target.",
    },
    missing: {
      tone: "error" as const,
      message: "Supply unavailable. Refresh the inventory list.",
    },
    changed: {
      tone: "warning" as const,
      message:
        "This supply changed while you were editing. Refresh and review its current threshold.",
    },
    failed: {
      tone: "error" as const,
      message: "Unable to save this par target. Refresh and try again.",
    },
  };
  const notice =
    query.notice && query.notice in notices
      ? notices[query.notice as keyof typeof notices]
      : null;

  return (
    <AdminPage
      title="Inventory par targets"
      description="Choose the target stock level for each supply and see how much is needed to refill it."
      action={
        <Button asChild variant="outline">
          <Link href="/admin/inventory">Back to inventory</Link>
        </Button>
      }
    >
      {notice ? (
        <ToastOnMount tone={notice.tone} description={notice.message} />
      ) : null}
      <Card className="p-4 text-sm">
        {configured} of {count} active supplies have a par target. A par target
        is a planning quantity, above the low-stock warning threshold. Suggested
        refill amounts use current stock; this screen does not order or receive
        goods automatically.
      </Card>
      <DataTableCard>
        <Table>
          <thead>
            <tr>
              <TableHead>Supply</TableHead>
              <TableHead>On hand</TableHead>
              <TableHead>Low warning</TableHead>
              <TableHead>Par target</TableHead>
              <TableHead>Refill to par</TableHead>
            </tr>
          </thead>
          <tbody>
            {supplies.length ? (
              supplies.map((supply) => {
                const unit = supply.canonicalUnit
                  ? canonicalUnitLabel(supply.canonicalUnit)
                  : supply.unit;
                const needed = quantityToPar(supply.stockQty, supply.parLevel);
                return (
                  <tr key={supply.id} className="border-t align-top">
                    <TableCell>
                      <div className="font-semibold">{supply.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {supply.quantityCoverage === "LEGACY_INCOMPLETE"
                          ? "Unit mapping incomplete; verify quantities"
                          : unit}
                      </div>
                    </TableCell>
                    <TableCell>
                      {supply.stockQty.toString()} {unit}
                    </TableCell>
                    <TableCell>
                      {supply.lowStockThreshold.toString()} {unit}
                    </TableCell>
                    <TableCell>
                      {canEdit ? (
                        <form
                          action={updateSupplyParLevelAction}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <input
                            type="hidden"
                            name="supplyId"
                            value={supply.id}
                          />
                          <input
                            aria-label={`Par target for ${supply.name} in ${unit}`}
                            name="parLevel"
                            type="number"
                            min="0.000001"
                            step="0.000001"
                            max="999999999999.999999"
                            placeholder="Not set"
                            defaultValue={supply.parLevel?.toString() ?? ""}
                            className="w-36 rounded border px-2 py-1"
                          />
                          <Button type="submit" size="sm">
                            Save
                          </Button>
                        </form>
                      ) : (
                        (supply.parLevel?.toString() ?? "Not set")
                      )}
                      {supply.parLevel &&
                      supply.parLevel.lte(supply.lowStockThreshold) ? (
                        <p className="text-xs text-amber-700">
                          Raise par above the low warning.
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {needed == null
                        ? "Not set"
                        : `${needed.toString()} ${unit}`}
                    </TableCell>
                  </tr>
                );
              })
            ) : (
              <tr>
                <TableCell colSpan={5}>No active supplies found.</TableCell>
              </tr>
            )}
          </tbody>
        </Table>
      </DataTableCard>
      <nav aria-label="Par target pages" className="flex justify-end gap-2">
        {page > 1 ? (
          <Button asChild variant="outline">
            <Link href={`/admin/inventory/par-levels?page=${page - 1}`}>
              Previous
            </Link>
          </Button>
        ) : null}
        {page < pages ? (
          <Button asChild variant="outline">
            <Link href={`/admin/inventory/par-levels?page=${page + 1}`}>
              Next
            </Link>
          </Button>
        ) : null}
      </nav>
    </AdminPage>
  );
}
