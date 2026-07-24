"use server";

import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import type {
  SupplierInvoiceDraftInput,
  SupplierInvoiceLineInput,
} from "@/lib/suppliers/invoice-foundation";
import {
  finalizeSupplierInvoice,
  saveSupplierInvoiceDraft,
  voidSupplierInvoiceDraft,
} from "@/lib/suppliers/invoice-service";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function values(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => String(value));
}

function draftFromFormData(formData: FormData): SupplierInvoiceDraftInput {
  const kinds = values(formData, "lineKind");
  const catalogItemIds = values(formData, "catalogItemId");
  const itemNames = values(formData, "itemName");
  const itemUnits = values(formData, "itemUnit");
  const quantities = values(formData, "quantity");
  const unitPrices = values(formData, "unitPrice");
  const lineNotes = values(formData, "lineNotes");
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

  return {
    invoiceNumber: text(formData, "invoiceNumber"),
    invoiceDate: text(formData, "invoiceDate"),
    dueDate: text(formData, "dueDate"),
    notes: text(formData, "notes"),
    lines,
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
  revalidatePath("/admin/dashboard");
  if (purchaseOrderId) {
    revalidatePath(`/admin/supplier-purchase-orders/${purchaseOrderId}`);
    revalidatePath(`/print/supplier-purchase-orders/${purchaseOrderId}`);
  }
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
