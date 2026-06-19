"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import {
  approveSupplierDelivery,
  processSupplierDelivery,
  recordSupplierPayment,
  rejectSupplierDelivery,
  type VerifiedDeliveryItemInput,
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

function refreshSupplierPages(id?: string) {
  revalidatePath("/admin/supplier-deliveries");
  revalidatePath("/admin/reports/supplier-bills");
  revalidatePath("/admin/inventory");
  if (id) revalidatePath(`/admin/supplier-deliveries/${id}`);
}

export async function approveDeliveryAction(formData: FormData) {
  const user = await requireRole(["ADMIN", "MANAGER"]);
  const deliveryId = text(formData, "deliveryId");
  const itemIds = formData.getAll("itemId").map(String);
  const rows: VerifiedDeliveryItemInput[] = itemIds.map((itemId) => ({
    itemId,
    target: text(formData, `target-${itemId}`) as VerifiedDeliveryItemInput["target"],
    verifiedQuantity: Number(formData.get(`quantity-${itemId}`)),
    unitPrice: optionalMoney(formData.get(`unitPrice-${itemId}`)),
    totalPrice: optionalMoney(formData.get(`totalPrice-${itemId}`)),
    notes: text(formData, `notes-${itemId}`),
  }));
  await approveSupplierDelivery(deliveryId, user.id, rows, text(formData, "notes"));
  refreshSupplierPages(deliveryId);
}

export async function rejectDeliveryAction(formData: FormData) {
  const user = await requireRole(["ADMIN", "MANAGER"]);
  const deliveryId = text(formData, "deliveryId");
  await rejectSupplierDelivery(deliveryId, user.id, text(formData, "reason"));
  refreshSupplierPages(deliveryId);
}

export async function retryDeliveryAiAction(formData: FormData) {
  await requireRole(["ADMIN", "MANAGER"]);
  const deliveryId = text(formData, "deliveryId");
  try {
    await processSupplierDelivery(deliveryId);
  } finally {
    refreshSupplierPages(deliveryId);
  }
}

export async function recordPaymentAction(formData: FormData) {
  const user = await requireRole(["ADMIN", "MANAGER"]);
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
