"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { validateReceivedQuantities } from "@/lib/suppliers/receiving";
import {
  completePurchaseOrderAndCreateInvoiceDraft,
  createInvoiceDraftForCompletedPurchaseOrder,
  SupplierPurchaseOrderInvoiceError,
} from "@/lib/suppliers/invoice-service";
import {
  calculateSupplierPurchaseOrderLineTotal,
  calculateSupplierPurchaseOrderTotal,
  isSupplierPurchaseDeliveryDateAllowed,
  supplierPurchaseDateKeyToDatabaseDate,
  validateSupplierPurchaseOrderRows,
} from "@/lib/suppliers/purchase-orders";

type NewOrderStatus =
  | "invalid_supplier"
  | "invalid_date"
  | "empty_order"
  | "duplicate_item"
  | "invalid_row"
  | "unavailable_item";

class PurchaseOrderInputError extends Error {
  constructor(readonly status: NewOrderStatus) {
    super(status);
  }
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function newOrderPath(supplierId: string, status: NewOrderStatus) {
  const query = new URLSearchParams({ orderStatus: status });
  if (supplierId) query.set("supplier", supplierId);
  return `/admin/supplier-purchase-orders/new?${query.toString()}`;
}

function redirectToNewOrder(supplierId: string, status: NewOrderStatus): never {
  redirect(newOrderPath(supplierId, status));
}

function refreshPurchaseOrders(id?: string, invoiceId?: string) {
  revalidatePath("/admin/supplier-purchase-orders");
  revalidatePath("/admin/supplier-invoices");
  revalidatePath("/admin/suppliers");
  if (id) {
    revalidatePath(`/admin/supplier-purchase-orders/${id}`);
    revalidatePath(`/print/supplier-purchase-orders/${id}`);
  }
  if (invoiceId) {
    revalidatePath(`/admin/supplier-invoices/${invoiceId}`);
    revalidatePath(`/print/supplier-invoices/${invoiceId}`);
  }
}

function purchaseOrderInvoiceFailurePath(id: string, error: unknown) {
  const status =
    error instanceof SupplierPurchaseOrderInvoiceError
      ? error.code
      : "invoice_failed";
  return `/admin/supplier-purchase-orders/${encodeURIComponent(id)}?orderStatus=${status}`;
}

export async function createSupplierPurchaseOrder(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const supplierId = text(formData, "supplierId");
  const expectedDeliveryDateKey = text(formData, "expectedDeliveryDate");
  const notes = text(formData, "notes").slice(0, 2000);
  if (!supplierId) redirectToNewOrder("", "invalid_supplier");
  if (!isSupplierPurchaseDeliveryDateAllowed(expectedDeliveryDateKey)) {
    redirectToNewOrder(supplierId, "invalid_date");
  }

  const catalogItemIds = formData.getAll("catalogItemId").map(String);
  const quantities = formData.getAll("quantity").map(String);
  if (catalogItemIds.length !== quantities.length) {
    redirectToNewOrder(supplierId, "invalid_row");
  }
  const parsedRows = validateSupplierPurchaseOrderRows(
    catalogItemIds.map((catalogItemId, index) => ({
      catalogItemId,
      quantity: quantities[index] ?? "",
    })),
  );
  if (!parsedRows.ok) redirectToNewOrder(supplierId, parsedRows.status);

  const expectedDeliveryDate = supplierPurchaseDateKeyToDatabaseDate(
    expectedDeliveryDateKey,
  );
  if (!expectedDeliveryDate) redirectToNewOrder(supplierId, "invalid_date");

  let orderId: string;
  try {
    orderId = await prisma.$transaction(
      async (tx) => {
        const [supplier, catalogItems] = await Promise.all([
          tx.supplier.findFirst({
            where: { id: supplierId, isActive: true },
            select: { id: true },
          }),
          tx.supplierCatalogItem.findMany({
            where: {
              id: { in: parsedRows.rows.map((row) => row.catalogItemId) },
              supplierId,
              isActive: true,
            },
            select: {
              id: true,
              unit: true,
              unitPrice: true,
              product: { select: { name: true, isActive: true } },
              inventorySupply: { select: { name: true, isActive: true } },
            },
          }),
        ]);
        if (!supplier) throw new PurchaseOrderInputError("invalid_supplier");
        if (catalogItems.length !== parsedRows.rows.length) {
          throw new PurchaseOrderInputError("unavailable_item");
        }

        const catalogById = new Map(
          catalogItems.map((item) => [item.id, item]),
        );
        const lines = parsedRows.rows.map((row) => {
          const catalogItem = catalogById.get(row.catalogItemId);
          if (!catalogItem)
            throw new PurchaseOrderInputError("unavailable_item");
          const itemName = catalogItem.product?.isActive
            ? catalogItem.product.name
            : catalogItem.inventorySupply?.isActive
              ? catalogItem.inventorySupply.name
              : null;
          if (!itemName) throw new PurchaseOrderInputError("unavailable_item");

          return {
            supplierCatalogItemId: catalogItem.id,
            itemName,
            itemUnit: catalogItem.unit,
            quantity: row.quantity,
            unitPrice: catalogItem.unitPrice,
            lineTotal: calculateSupplierPurchaseOrderLineTotal(
              row.quantity,
              catalogItem.unitPrice,
            ),
          };
        });
        const totalAmount = calculateSupplierPurchaseOrderTotal(lines);
        const order = await tx.supplierPurchaseOrder.create({
          data: {
            supplierId,
            expectedDeliveryDate,
            notes: notes || null,
            totalAmount,
            createdByUserId: user.id,
            items: { create: lines },
          },
          select: { id: true },
        });
        return order.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof PurchaseOrderInputError) {
      redirectToNewOrder(supplierId, error.status);
    }
    throw error;
  }

  refreshPurchaseOrders(orderId);
  redirect(`/admin/supplier-purchase-orders/${orderId}?orderStatus=created`);
}

export async function updateSupplierPurchaseOrderStatus(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const id = text(formData, "id");
  const requestedStatus = text(formData, "status");
  if (!id) redirect("/admin/supplier-purchase-orders");
  if (requestedStatus !== "COMPLETED" && requestedStatus !== "CANCELLED") {
    redirect(
      `/admin/supplier-purchase-orders/${encodeURIComponent(id)}?orderStatus=invalid_status`,
    );
  }

  if (requestedStatus === "COMPLETED") {
    let invoiceId: string;
    try {
      const result = await completePurchaseOrderAndCreateInvoiceDraft(
        id,
        user.id,
      );
      invoiceId = result.invoiceId;
    } catch (error) {
      redirect(purchaseOrderInvoiceFailurePath(id, error));
    }
    refreshPurchaseOrders(id, invoiceId);
    redirect(`/admin/supplier-invoices/${encodeURIComponent(invoiceId)}`);
  }

  const now = new Date();
  const result = await prisma.supplierPurchaseOrder.updateMany({
    where: { id, status: "OPEN" },
    data: {
      status: requestedStatus,
      completedAt: null,
      cancelledAt: now,
    },
  });
  if (result.count !== 1) {
    redirect(
      `/admin/supplier-purchase-orders/${encodeURIComponent(id)}?orderStatus=not_open`,
    );
  }

  refreshPurchaseOrders(id);
  redirect(
    `/admin/supplier-purchase-orders/${encodeURIComponent(id)}?orderStatus=cancelled`,
  );
}

export async function createInvoiceForCompletedPurchaseOrderAction(
  formData: FormData,
) {
  const user = await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const id = text(formData, "id");
  if (!id) redirect("/admin/supplier-purchase-orders");

  let invoiceId: string;
  try {
    const result = await createInvoiceDraftForCompletedPurchaseOrder(
      id,
      user.id,
    );
    invoiceId = result.invoiceId;
  } catch (error) {
    redirect(purchaseOrderInvoiceFailurePath(id, error));
  }
  refreshPurchaseOrders(id, invoiceId);
  redirect(`/admin/supplier-invoices/${encodeURIComponent(invoiceId)}`);
}

export async function recordSupplierDeliveryAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.SUPPLIER_RECEIVE);
  const id = text(formData, "id");
  if (!id) redirect("/admin/supplier-purchase-orders");
  const destination = `/admin/supplier-purchase-orders/${encodeURIComponent(id)}`;
  const note = text(formData, "completionNote");
  const ratingValue = text(formData, "qualityRating");
  const qualityRating = ratingValue ? Number(ratingValue) : null;
  if (
    note.length > 2000 ||
    (qualityRating !== null &&
      (!Number.isInteger(qualityRating) ||
        qualityRating < 1 ||
        qualityRating > 5))
  ) {
    redirect(`${destination}?orderStatus=invalid_delivery`);
  }

  let status = "delivery_recorded";
  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.supplierPurchaseOrder.findUnique({
        where: { id },
        select: {
          status: true,
          receiving: { select: { id: true } },
          items: { select: { id: true, quantity: true } },
        },
      });
      if (!order || order.status !== "COMPLETED" || order.receiving) {
        throw new Error("delivery_unavailable");
      }
      const result = validateReceivedQuantities(
        order.items,
        order.items.map((item) => ({
          id: item.id,
          quantity: text(formData, `received-${item.id}`),
        })),
      );
      if (!result.ok || (result.hasDifference && !note)) {
        throw new Error("invalid_delivery");
      }
      await tx.supplierReceiving.create({
        data: {
          purchaseOrderId: id,
          receivedByUserId: user.id,
          qualityRating,
          completionNote: note || null,
          items: {
            create: result.rows.map((row) => ({
              purchaseOrderItemId: row.id,
              expectedQuantity: row.expected,
              receivedQuantity: row.received,
            })),
          },
        },
      });
    });
  } catch (error) {
    status =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
        ? "delivery_unavailable"
        : error instanceof Error &&
            (error.message === "invalid_delivery" ||
              error.message === "delivery_unavailable")
          ? error.message
          : "delivery_failed";
  }
  revalidatePath(destination);
  redirect(`${destination}?orderStatus=${status}`);
}
