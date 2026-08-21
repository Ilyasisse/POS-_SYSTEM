import { Prisma } from "@prisma/client";
import type { PurchaseOrderPdfInput } from "./purchase-order-pdf";

export const purchaseOrderPdfInclude = {
  supplier: true,
  createdBy: { select: { fullName: true } },
  items: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.SupplierPurchaseOrderInclude;

export type PurchaseOrderPdfSnapshot =
  Prisma.SupplierPurchaseOrderGetPayload<{
    include: typeof purchaseOrderPdfInclude;
  }>;

export function purchaseOrderPdfInput(
  order: PurchaseOrderPdfSnapshot,
): PurchaseOrderPdfInput {
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    supplierName: order.supplier.name,
    supplierContact: order.supplier.contactName,
    supplierPhone: order.supplier.phone,
    createdAt: order.createdAt,
    expectedDeliveryDate: order.expectedDeliveryDate,
    preparedBy: order.createdBy.fullName,
    notes: order.notes,
    totalAmount: order.totalAmount.toString(),
    items: order.items.map((item) => ({
      name: item.itemName,
      unit: item.itemUnit,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(),
      lineTotal: item.lineTotal.toString(),
    })),
  };
}

export function samplePurchaseOrderPdfInput(): PurchaseOrderPdfInput {
  return {
    orderNumber: 1001,
    status: "OPEN",
    supplierName: "Sample Supplier",
    supplierContact: "Supplier Contact",
    supplierPhone: "+15551234567",
    createdAt: new Date("2026-08-15T00:00:00.000Z"),
    expectedDeliveryDate: new Date("2026-08-16T00:00:00.000Z"),
    preparedBy: "Mash Allah Cafe",
    notes: "Non-sensitive sample generated for WhatsApp template approval.",
    totalAmount: "25.00",
    items: [
      {
        name: "Sample catalog item",
        unit: "case",
        quantity: "1",
        unitPrice: "25.00",
        lineTotal: "25.00",
      },
    ],
  };
}
