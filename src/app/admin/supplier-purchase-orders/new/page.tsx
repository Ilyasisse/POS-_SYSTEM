import { AdminPage, Button } from "@/components/admin/shared";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import {
  getSupplierPurchaseDefaultDeliveryDateKey,
  getSupplierPurchaseTodayDateKey,
} from "@/lib/suppliers/purchase-orders";
import PurchaseOrderBuilder from "./PurchaseOrderBuilder";

function statusMessage(status: string | undefined) {
  switch (status) {
    case "invalid_supplier":
      return "Choose an active supplier.";
    case "invalid_date":
      return "Choose an expected delivery date that is today or later.";
    case "empty_order":
      return "Add at least one item to the purchase order.";
    case "duplicate_item":
      return "Each supplier catalog item can appear only once per order.";
    case "invalid_row":
      return "Every order row needs an item and a positive quantity with no more than three decimals.";
    case "unavailable_item":
      return "An item or price changed while the order was open. Review the supplier catalog and try again.";
    default:
      return null;
  }
}

export default async function NewSupplierPurchaseOrderPage({
  searchParams,
}: {
  searchParams?: Promise<{ supplier?: string; orderStatus?: string }>;
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
  const message = statusMessage(query.orderStatus);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  return (
    <AdminPage
      title="Create supplier purchase order"
      description="Select a supplier, add items from its active catalog, and record the order you place by phone."
      action={
        <Button asChild variant="outline">
          <Link href="/admin/supplier-purchase-orders">
            Back to purchase orders
          </Link>
        </Button>
      }
    >
      {message ? (
        <Alert variant="destructive">
          <AlertTitle>Purchase order not created</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      <PurchaseOrderBuilder
        suppliers={suppliers}
        selectedSupplier={
          selectedSupplier
            ? { id: selectedSupplier.id, name: selectedSupplier.name }
            : null
        }
        catalogItems={catalogItems}
        todayDateKey={getSupplierPurchaseTodayDateKey(now)}
        defaultDeliveryDateKey={getSupplierPurchaseDefaultDeliveryDateKey(
          yesterday,
        )}
      />
    </AdminPage>
  );
}
