"use server";

import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import {
  approveExtractedSupplierDelivery,
  processSupplierDelivery,
  recordSupplierPayment,
  rejectSupplierDelivery,
} from "@/lib/suppliers/delivery-service";

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function optionalMoney(value: FormDataEntryValue | null) {
  if (value == null || String(value).trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error("Prices must be non-negative numbers.");
  return parsed;
}

function requiredMoney(value: FormDataEntryValue | null) {
  const parsed = optionalMoney(value);
  if (parsed == null) throw new Error("Every invoice item needs a line total.");
  return parsed;
}

function optionalDate(value: string) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Enter a valid invoice date.");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Enter a valid invoice date.");
  return date;
}

function refreshSupplierPages(id?: string) {
  revalidatePath("/admin/supplier-deliveries");
  revalidatePath("/admin/reports/supplier-bills");
  revalidatePath("/admin/inventory");
  if (id) revalidatePath(`/admin/supplier-deliveries/${id}`);
}

export async function approveExtractedDeliveryAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const deliveryId = text(formData, "deliveryId");
  const rowIds = formData.getAll("rowId").map(String);
  if (rowIds.length > 100) throw new Error("An invoice can contain at most 100 items.");
  if (new Set(rowIds).size !== rowIds.length) throw new Error("Duplicate invoice item.");

  await approveExtractedSupplierDelivery(deliveryId, user.id, {
    invoiceNumber: text(formData, "invoiceNumber"),
    receiptDate: optionalDate(text(formData, "receiptDate")),
    reviewedText: text(formData, "reviewedText"),
    notes: text(formData, "notes"),
    rows: rowIds.map((rowId) => ({
      description: text(formData, `description-${rowId}`),
      target: text(formData, `target-${rowId}`),
      quantity: Number(formData.get(`quantity-${rowId}`)),
      unitPrice: optionalMoney(formData.get(`unitPrice-${rowId}`)),
      totalPrice: requiredMoney(formData.get(`totalPrice-${rowId}`)),
    })),
  });
  refreshSupplierPages(deliveryId);
}

export async function rejectDeliveryAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const deliveryId = text(formData, "deliveryId");
  await rejectSupplierDelivery(deliveryId, user.id, text(formData, "reason"));
  refreshSupplierPages(deliveryId);
}

export async function retryDeliveryExtractionAction(formData: FormData) {
  await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const deliveryId = text(formData, "deliveryId");
  try {
    await processSupplierDelivery(deliveryId);
  } finally {
    refreshSupplierPages(deliveryId);
  }
}

export async function recordPaymentAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const billId = text(formData, "billId");
  await recordSupplierPayment(
    billId,
    user.id,
    Number(formData.get("amount")),
    text(formData, "paymentMethod"),
    text(formData, "notes"),
  );
  refreshSupplierPages();
}
