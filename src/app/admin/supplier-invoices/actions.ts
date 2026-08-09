"use server";

import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import type {
  SupplierInvoiceDraftInput,
  SupplierInvoiceLineInput,
} from "@/lib/suppliers/invoice-foundation";
import {
  createSupplierInvoiceDraft,
  finalizeSupplierInvoice,
  saveSupplierInvoiceDraft,
  voidSupplierInvoiceDraft,
} from "@/lib/suppliers/invoice-service";
import type { SupplierInvoiceRecurrenceInput } from "@/lib/suppliers/invoice-recurrence";
import {
  createSupplierInvoiceRecurrence,
  pauseSupplierInvoiceRecurrence,
  resumeSupplierInvoiceRecurrence,
  updateSupplierInvoiceRecurrence,
} from "@/lib/suppliers/invoice-recurrence-service";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function values(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => String(value));
}

function recurrenceFromFormData(
  formData: FormData,
): SupplierInvoiceRecurrenceInput {
  return {
    interval: text(formData, "recurrenceInterval"),
    unit: text(formData, "recurrenceUnit"),
    nextRunDate: text(formData, "recurrenceNextRunDate"),
  };
}

function draftFromFormData(formData: FormData): SupplierInvoiceDraftInput {
  const kinds = values(formData, "lineKind");
  const catalogItemIds = values(formData, "catalogItemId");
  const itemNames = values(formData, "itemName");
  const itemUnits = values(formData, "itemUnit");
  const quantities = values(formData, "quantity");
  const unitPrices = values(formData, "unitPrice");
  const lineNotes = values(formData, "lineNotes");
  const installmentIds = values(formData, "installmentId");
  const installmentDates = values(formData, "installmentDueDate");
  const installmentAmounts = values(formData, "installmentAmount");
  const expectedLength = kinds.length;
  if (
    !expectedLength ||
    [
      catalogItemIds,
      itemNames,
      itemUnits,
      quantities,
      unitPrices,
      lineNotes,
    ].some((rows) => rows.length !== expectedLength)
  ) {
    throw new Error(
      "The invoice item list is incomplete. Refresh and try again.",
    );
  }

  const lines: SupplierInvoiceLineInput[] = kinds.map((kind, index) => {
    if (kind !== "catalog" && kind !== "custom") {
      throw new Error(`Invoice item ${index + 1} has an invalid item type.`);
    }
    return {
      kind,
      catalogItemId: catalogItemIds[index],
      itemName: itemNames[index] ?? "",
      itemUnit: itemUnits[index] ?? "",
      quantity: quantities[index] ?? "",
      unitPrice: unitPrices[index] ?? "",
      notes: lineNotes[index],
    };
  });

  if (
    installmentIds.length !== installmentDates.length ||
    installmentIds.length !== installmentAmounts.length
  ) {
    throw new Error("The installment schedule is incomplete. Refresh and try again.");
  }

  return {
    supplierReference: text(formData, "supplierReference"),
    invoiceDate: text(formData, "invoiceDate"),
    dueDate: text(formData, "dueDate"),
    notes: text(formData, "notes"),
    lines,
    installments: installmentDates.map((dueDate, index) => ({
      id: installmentIds[index],
      dueDate,
      amount: installmentAmounts[index] ?? "",
    })),
  };
}

async function manualDraftFromFormData(
  formData: FormData,
  supplierId: string,
): Promise<SupplierInvoiceDraftInput> {
  const catalogItemIds = values(formData, "catalogItemId");
  const quantities = values(formData, "quantity");
  const unitPrices = values(formData, "unitPrice");
  const lineNotes = values(formData, "lineNotes");
  const expectedLength = catalogItemIds.length;
  if (
    !expectedLength ||
    [quantities, unitPrices, lineNotes].some(
      (rows) => rows.length !== expectedLength,
    )
  ) {
    throw new Error("The invoice item list is incomplete. Refresh and try again.");
  }

  const catalogItems = await prisma.supplierCatalogItem.findMany({
    where: {
      id: { in: catalogItemIds },
      supplierId,
      isActive: true,
    },
    select: {
      id: true,
      unit: true,
      product: { select: { name: true, isActive: true } },
      inventorySupply: { select: { name: true, isActive: true } },
    },
  });
  const catalogById = new Map(catalogItems.map((item) => [item.id, item]));

  return {
    supplierReference: text(formData, "supplierReference"),
    invoiceDate: text(formData, "invoiceDate"),
    dueDate: text(formData, "dueDate"),
    notes: text(formData, "notes"),
    lines: catalogItemIds.map((catalogItemId, index) => {
      const item = catalogById.get(catalogItemId);
      const itemName = item?.product?.isActive
        ? item.product.name
        : item?.inventorySupply?.isActive
          ? item.inventorySupply.name
          : null;
      if (!item || !itemName) {
        throw new Error("An invoice item is no longer available from this supplier.");
      }
      return {
        kind: "catalog" as const,
        catalogItemId,
        itemName,
        itemUnit: item.unit,
        quantity: quantities[index] ?? "",
        unitPrice: unitPrices[index] ?? "",
        notes: lineNotes[index],
      };
    }),
  };
}

function refreshInvoicePages(
  invoiceId: string,
  purchaseOrderId?: string | null,
) {
  revalidatePath("/admin/supplier-invoices");
  revalidatePath(`/admin/supplier-invoices/${invoiceId}`);
  revalidatePath(`/print/supplier-invoices/${invoiceId}`);
  revalidatePath("/admin/supplier-purchase-orders");
  revalidatePath("/admin/reports/supplier-bills");
  revalidatePath("/admin");
  if (purchaseOrderId) {
    revalidatePath(`/admin/supplier-purchase-orders/${purchaseOrderId}`);
    revalidatePath(`/print/supplier-purchase-orders/${purchaseOrderId}`);
  }
}

export async function createManualSupplierInvoiceDraftAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const supplierId = text(formData, "supplierId");
  if (!supplierId) throw new Error("Choose a valid supplier.");
  const invoice = await createSupplierInvoiceDraft({
    supplierId,
    source: "MANUAL",
    createdByUserId: user.id,
    recurrence:
      formData.get("recurrenceEnabled") === "on"
        ? recurrenceFromFormData(formData)
        : null,
    draft: await manualDraftFromFormData(formData, supplierId),
  });
  refreshInvoicePages(invoice.id);
  return {
    message: "Invoice draft created.",
    redirectTo: `/admin/supplier-invoices/${encodeURIComponent(invoice.id)}?invoiceStatus=created`,
  };
}

export async function createSupplierInvoiceRecurrenceAction(
  formData: FormData,
) {
  const user = await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const invoiceId = text(formData, "invoiceId");
  await createSupplierInvoiceRecurrence({
    invoiceId,
    createdByUserId: user.id,
    recurrence: recurrenceFromFormData(formData),
  });
  refreshInvoicePages(invoiceId);
  return { message: "Recurring schedule created." };
}

export async function updateSupplierInvoiceRecurrenceAction(
  formData: FormData,
) {
  await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const invoiceId = text(formData, "invoiceId");
  await updateSupplierInvoiceRecurrence({
    recurrenceId: text(formData, "recurrenceId"),
    recurrence: recurrenceFromFormData(formData),
  });
  refreshInvoicePages(invoiceId);
  return { message: "Recurring schedule updated." };
}

export async function pauseSupplierInvoiceRecurrenceAction(
  formData: FormData,
) {
  const user = await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const invoiceId = text(formData, "invoiceId");
  await pauseSupplierInvoiceRecurrence({
    recurrenceId: text(formData, "recurrenceId"),
    pausedByUserId: user.id,
  });
  refreshInvoicePages(invoiceId);
  return { message: "Recurring schedule paused." };
}

export async function resumeSupplierInvoiceRecurrenceAction(
  formData: FormData,
) {
  const user = await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const invoiceId = text(formData, "invoiceId");
  await resumeSupplierInvoiceRecurrence({
    recurrenceId: text(formData, "recurrenceId"),
    resumedByUserId: user.id,
    recurrence: recurrenceFromFormData(formData),
  });
  refreshInvoicePages(invoiceId);
  return { message: "Recurring schedule resumed." };
}

export async function saveSupplierInvoiceDraftAction(formData: FormData) {
  await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const invoiceId = text(formData, "invoiceId");
  const invoice = await saveSupplierInvoiceDraft(
    invoiceId,
    draftFromFormData(formData),
  );
  refreshInvoicePages(invoiceId, invoice.purchaseOrderId);
  return { message: "Invoice draft saved." };
}

export async function finalizeSupplierInvoiceAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const invoiceId = text(formData, "invoiceId");
  const result = await finalizeSupplierInvoice(
    invoiceId,
    user.id,
    draftFromFormData(formData),
  );
  refreshInvoicePages(invoiceId, result.purchaseOrderId);
  return {
    message: "Invoice approved and supplier bill created.",
    redirectTo: `/admin/supplier-invoices/${encodeURIComponent(result.invoiceId)}?invoiceStatus=approved`,
  };
}

export async function voidSupplierInvoiceDraftAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const invoiceId = text(formData, "invoiceId");
  const result = await voidSupplierInvoiceDraft(
    invoiceId,
    user.id,
    text(formData, "voidReason"),
  );
  refreshInvoicePages(invoiceId, result.purchaseOrderId);
  return {
    message: result.purchaseOrderId
      ? "Invoice voided and purchase order reopened."
      : "Invoice voided.",
    redirectTo: result.purchaseOrderId
      ? `/admin/supplier-purchase-orders/${encodeURIComponent(result.purchaseOrderId)}?orderStatus=invoice_voided`
      : `/admin/supplier-invoices/${encodeURIComponent(invoiceId)}?invoiceStatus=voided`,
  };
}
