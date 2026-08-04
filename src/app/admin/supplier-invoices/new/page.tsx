import Link from "next/link";
import { AdminPage, Button } from "@/components/admin/shared";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import {
  getSupplierBillDefaultDueDateKey,
  getSupplierPurchaseTodayDateKey,
} from "@/lib/suppliers/purchase-orders";
import ManualSupplierInvoiceBuilder from "./ManualSupplierInvoiceBuilder";

export default async function NewSupplierInvoicePage({
  searchParams,
}: {
  searchParams?: Promise<{ supplier?: string }>;
}) {
  await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const query = (await searchParams) ?? {};
  const [suppliers, selectedSupplier] = await Promise.all([
    prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    query.supplier
      ? prisma.supplier.findFirst({
          where: { id: query.supplier, isActive: true },
          select: {
            id: true,
            name: true,
            catalogItems: {
              where: { isActive: true },
              select: {
                id: true,
                unit: true,
                unitPrice: true,
                product: { select: { name: true, isActive: true } },
                inventorySupply: { select: { name: true, isActive: true } },
              },
            },
          },
        })
      : null,
  ]);
  const catalogItems = (selectedSupplier?.catalogItems ?? [])
    .flatMap((item) => {
      const name = item.product?.isActive
        ? item.product.name
        : item.inventorySupply?.isActive
          ? item.inventorySupply.name
          : null;
      return name
        ? [
            {
              id: item.id,
              name,
              unit: item.unit,
              unitPrice: item.unitPrice.toFixed(2),
            },
          ]
        : [];
    })
    .sort((left, right) => left.name.localeCompare(right.name));
  const now = new Date();

  return (
    <AdminPage
      title="Create supplier invoice"
      description="Record a supplier invoice directly from its active catalog items."
      action={
        <Button asChild variant="outline">
          <Link href="/admin/supplier-invoices">Back to invoices</Link>
        </Button>
      }
    >
      <ManualSupplierInvoiceBuilder
        suppliers={suppliers}
        selectedSupplier={
          selectedSupplier
            ? { id: selectedSupplier.id, name: selectedSupplier.name }
            : null
        }
        catalogItems={catalogItems}
        todayDateKey={getSupplierPurchaseTodayDateKey(now)}
        defaultDueDateKey={getSupplierBillDefaultDueDateKey(now)}
      />
    </AdminPage>
  );
}
