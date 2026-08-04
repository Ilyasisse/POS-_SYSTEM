"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { createManualExpense, deleteManualExpense, finalizeDailyCash, overrideDailySalary, payDailyCashObligation, payDailySalary, undoDailyCashSupplierPayment, undoDailySalary } from "@/lib/daily-cash/service";

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();
const money = (formData: FormData, name: string) => Number(formData.get(name));
function refresh() { revalidatePath("/admin/daily-cash"); revalidatePath("/admin/reports/supplier-bills"); revalidatePath("/admin"); }

export async function overrideSalaryAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.DAILY_CASH_MANAGE);
  await overrideDailySalary({ dateKey: text(formData, "date"), amount: money(formData, "amount"), userId: user.id });
  refresh();
}
export async function paySalaryAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.DAILY_CASH_MANAGE);
  const result = await payDailySalary({ dateKey: text(formData, "date"), userId: user.id, confirmSavings: formData.get("confirmSavings") === "on" });
  if (!result.ok) throw new Error(result.code === "SAVINGS_CONFIRMATION_REQUIRED" ? `This payment needs $${result.savingsAmount} from savings. Tick the confirmation box and submit again.` : result.message);
  refresh();
}
export async function createManualExpenseAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.DAILY_CASH_MANAGE);
  const result = await createManualExpense({ dateKey: text(formData, "date"), description: text(formData, "description"), amount: money(formData, "amount"), note: text(formData, "note"), userId: user.id, confirmSavings: formData.get("confirmSavings") === "on" });
  if (!result.ok) throw new Error(result.code === "SAVINGS_CONFIRMATION_REQUIRED" ? `This expense needs $${result.savingsAmount} from savings. Tick the confirmation box and submit again.` : result.message);
  refresh();
}
export async function deleteManualExpenseAction(formData: FormData) {
  await requirePermission(PERMISSIONS.DAILY_CASH_MANAGE);
  await deleteManualExpense({ dateKey: text(formData, "date"), id: text(formData, "id") });
  refresh();
}
export async function undoPaidActivityAction(input: { date: string; type: "SALARY" | "SUPPLIER" | "MANUAL"; rowId: string }) {
  await requirePermission(PERMISSIONS.DAILY_CASH_MANAGE);
  const prefix = `${input.type.toLowerCase()}:`;
  if (!input.rowId.startsWith(prefix)) throw new Error("Invalid paid activity.");
  const sourceId = input.rowId.slice(prefix.length);
  if (!sourceId) throw new Error("Paid activity not found.");

  if (input.type === "SALARY") {
    await undoDailySalary({ dateKey: input.date });
  } else if (input.type === "MANUAL") {
    await deleteManualExpense({ dateKey: input.date, id: sourceId });
  } else if (input.type === "SUPPLIER") {
    await undoDailyCashSupplierPayment({ dateKey: input.date, id: sourceId });
  } else {
    throw new Error("Invalid paid activity type.");
  }
  refresh();
}
export async function paySupplierObligationAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.DAILY_CASH_MANAGE);
  const result = await payDailyCashObligation({ dateKey: text(formData, "date"), billId: text(formData, "billId"), installmentId: text(formData, "installmentId") || null, amount: money(formData, "amount"), userId: user.id, confirmSavings: formData.get("confirmSavings") === "on" });
  if (!result.ok) throw new Error(result.code === "SAVINGS_CONFIRMATION_REQUIRED" ? `This payment needs $${result.savingsAmount} from savings. Tick the confirmation box and submit again.` : result.message);
  refresh();
}
export async function finalizeDailyCashAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.DAILY_CASH_MANAGE);
  await finalizeDailyCash({ dateKey: text(formData, "date"), userId: user.id });
  refresh();
}
