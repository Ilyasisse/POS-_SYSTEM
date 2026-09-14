"use server";

import { revalidatePath } from "next/cache";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import {
  recordSupplierPayment,
  revertSupplierPayment,
  splitSupplierBillIntoInstallments,
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

function refreshSupplierBillPages(invoiceIds: readonly string[]) {
  revalidatePath("/admin/supplier-invoices");
  for (const invoiceId of invoiceIds) {
    revalidatePath(`/admin/supplier-invoices/${invoiceId}`);
    revalidatePath(`/print/supplier-invoices/${invoiceId}`);
  }
  revalidatePath("/admin/reports/supplier-bills");
  revalidatePath("/admin/suppliers");
  revalidatePath("/admin");
}

export async function recordPaymentAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const result = await recordSupplierPayment({
    supplierId: text(formData, "supplierId"),
    preferredBillId: text(formData, "billId"),
    preferredInstallmentId: text(formData, "installmentId") || null,
    recordedByUserId: user.id,
    amount: Number(formData.get("amount")),
    paymentMethod: text(formData, "paymentMethod"),
    notes: text(formData, "notes"),
    allowOverpayment: formData.get("allowOverpayment") === "on",
  });
  refreshSupplierBillPages(result.invoiceIds);
  revalidatePath(`/admin/suppliers/${text(formData, "supplierId")}`);
}

export async function revertSupplierPaymentAction(paymentId: string) {
  const user = await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const result = await revertSupplierPayment(paymentId, {
    canManageDailyCash: hasPermission(user, PERMISSIONS.DAILY_CASH_MANAGE),
  });
  refreshSupplierBillPages(result.invoiceIds);
  revalidatePath(`/admin/suppliers/${result.supplierId}`);
  if (result.dailyCashBusinessDate) {
    revalidatePath("/admin/daily-cash");
  }
}

export async function splitSupplierBillIntoInstallmentsAction(formData: FormData) {
  await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const dates = formData.getAll("installmentDueDate").map((value) => String(value));
  const amounts = formData.getAll("installmentAmount").map((value) => Number(value));
  if (!dates.length || dates.length !== amounts.length) {
    throw new Error("The installment schedule is incomplete.");
  }
  const result = await splitSupplierBillIntoInstallments(
    text(formData, "billId"),
    dates.map((date, index) => ({
      dueDate: requiredSupplierBillDueDate(date),
      amount: amounts[index],
    })),
  );
  refreshSupplierBillPages([result.invoiceId]);
}

export async function updateSupplierBillDueDateAction(formData: FormData) {
  await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const result = await updateSupplierBillDueDate(
    text(formData, "billId"),
    requiredSupplierBillDueDate(text(formData, "dueDate")),
  );
  refreshSupplierBillPages([result.invoiceId]);
}
