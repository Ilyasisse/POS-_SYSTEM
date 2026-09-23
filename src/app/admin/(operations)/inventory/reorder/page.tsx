import Link from "next/link";
import { AdminPage, Card } from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { canonicalUnitLabel } from "@/lib/inventory/inventory-domain";
import { reorderStatus } from "@/lib/inventory/reorder-review";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ReorderReviewPage() {
  await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const [supplies, products] = await Promise.all([
    prisma.inventorySupply.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        stockQty: true,
        lowStockThreshold: true,
        canonicalUnit: true,
        supplierCatalogItems: {
          where: { isActive: true, supplier: { isActive: true } },
          select: {
            id: true,
            unit: true,
            unitPrice: true,
            supplierId: true,
            supplier: { select: { name: true } },
          },
        },
      },
    }),
    prisma.product.findMany({
      where: { isActive: true, trackStock: true },
      select: {
        id: true,
        name: true,
        stockQty: true,
        lowStockThreshold: true,
        canonicalUnit: true,
        supplierCatalogItems: {
          where: { isActive: true, supplier: { isActive: true } },
          select: {
            id: true,
            unit: true,
            unitPrice: true,
            supplierId: true,
            supplier: { select: { name: true } },
          },
        },
      },
    }),
  ]);
  const entries = [
    ...supplies.map((item) => ({ ...item, kind: "Supply" as const })),
    ...products.map((item) => ({ ...item, kind: "Product" as const })),
  ]
    .flatMap((item) => {
      const status = reorderStatus(item.stockQty, item.lowStockThreshold);
      return status ? [{ ...item, status }] : [];
    })
    .sort(
      (a, b) =>
        (a.status === "OUT" ? 0 : 1) - (b.status === "OUT" ? 0 : 1) ||
        a.name.localeCompare(b.name),
    );

  return (
    <AdminPage
      title="Reorder review"
      description="Review stock shortages and matching active supplier catalog items."
      action={
        <Button variant="outline" asChild>
          <Link href="/admin/inventory">Back to inventory</Link>
        </Button>
      }
    >
      <Card className="p-5">
        <p className="text-sm text-slate-600">
          Out and low stock are calculated from current quantities and warning
          thresholds. The threshold is not a par level or a recommended purchase
          quantity. Check the required amount and purchase unit before
          submitting an order.
        </p>
      </Card>
      {entries.length ? (
        <ul className="space-y-4">
          {entries.map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              <Card className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-bold">
                    {item.name}{" "}
                    <span className="text-sm font-normal text-slate-600">
                      ({item.kind})
                    </span>
                  </h2>
                  <strong
                    className={
                      item.status === "OUT" ? "text-red-700" : "text-amber-700"
                    }
                  >
                    {item.status === "OUT" ? "Out of stock" : "Low stock"}
                  </strong>
                </div>
                <p className="mt-2 text-sm">
                  Available: {item.stockQty.toString()}{" "}
                  {canonicalUnitLabel(item.canonicalUnit)} · Warning threshold:{" "}
                  {item.lowStockThreshold.toString()}{" "}
                  {canonicalUnitLabel(item.canonicalUnit)}
                </p>
                {item.supplierCatalogItems.length ? (
                  <ul className="mt-4 space-y-2">
                    {item.supplierCatalogItems.map((catalog) => (
                      <li
                        key={catalog.id}
                        className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-sm"
                      >
                        <span>
                          {catalog.supplier.name} · $
                          {catalog.unitPrice.toFixed(2)} / {catalog.unit}
                        </span>
                        <Button variant="outline" size="sm" asChild>
                          <Link
                            href={`/admin/supplier-purchase-orders/new?supplier=${encodeURIComponent(catalog.supplierId)}&item=${encodeURIComponent(catalog.id)}`}
                          >
                            Start purchase order
                          </Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">
                    No active supplier catalog match. Add this item to a
                    supplier’s catalog before ordering.
                  </p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="p-5 text-sm text-slate-600">
          No active supplies or tracked products are below their warning
          thresholds.
        </Card>
      )}
    </AdminPage>
  );
}
