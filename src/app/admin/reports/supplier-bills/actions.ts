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

function refreshSupplierBillPages(invoiceId: string) {
  revalidatePath("/admin/supplier-invoices");
  revalidatePath(`/admin/supplier-invoices/${invoiceId}`);
  revalidatePath(`/print/supplier-invoices/${invoiceId}`);
  revalidatePath("/admin/reports/supplier-bills");
  revalidatePath("/admin");
}

export async function recordPaymentAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const result = await recordSupplierPayment(
    text(formData, "billId"),
    user.id,
    Number(formData.get("amount")),
    text(formData, "paymentMethod"),
    text(formData, "notes"),
  );
  refreshSupplierBillPages(result.invoiceId);
}

export async function updateSupplierBillDueDateAction(formData: FormData) {
  await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const result = await updateSupplierBillDueDate(
    text(formData, "billId"),
    requiredSupplierBillDueDate(text(formData, "dueDate")),
  );
  refreshSupplierBillPages(result.invoiceId);
}
