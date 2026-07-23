"use server";

import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import {
  recordSupplierPayment,
  updateSupplierBillDueDate,
} from "@/lib/suppliers/bill-service";
import { supplierPurchaseDateKeyToDatabaseDate } from "@/lib/suppliers/purchase-orders";

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function requiredSupplierBillDueDate(value: string) {
  const dueDate = supplierPurchaseDateKeyToDatabaseDate(value);
  if (!dueDate) throw new Error("Enter a valid supplier bill due date.");
  return dueDate;
}

function refreshSupplierBillPages() {
  revalidatePath("/admin/supplier-invoices");
  revalidatePath("/admin/reports/supplier-bills");
  revalidatePath("/admin/dashboard");
}

export async function recordPaymentAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  await recordSupplierPayment(
    text(formData, "billId"),
    user.id,
    Number(formData.get("amount")),
    text(formData, "paymentMethod"),
    text(formData, "notes"),
  );
  refreshSupplierBillPages();
}

export async function updateSupplierBillDueDateAction(formData: FormData) {
  await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  await updateSupplierBillDueDate(
    text(formData, "billId"),
    requiredSupplierBillDueDate(text(formData, "dueDate")),
  );
  refreshSupplierBillPages();
}
