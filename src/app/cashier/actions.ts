"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/requireRole";
import {
  closeWaiterBusinessDayShift,
  openWaiterBusinessDayShift,
  reopenWaiterBusinessDayShift,
} from "@/lib/waiter-shifts";

function buildReturnPath(
  waiterId: string,
  balanceStatus: string,
) {
  const params = new URLSearchParams();

  if (waiterId) {
    params.set("waiterId", waiterId);
  }

  if (balanceStatus) {
    params.set("balanceStatus", balanceStatus);
  }

  return params.size > 0 ? `/cashier?${params.toString()}` : "/cashier";
}

function parseAmount(value: FormDataEntryValue | null) {
  const parsedAmount = Number(String(value ?? "").trim());

  return Number.isFinite(parsedAmount) ? parsedAmount : null;
}

function refreshCashierAndWaiterViews() {
  revalidatePath("/cashier");
  revalidatePath("/cashier/reports");
  revalidatePath("/cashier/waiter-orders");
  revalidatePath("/admin/reports");
  revalidatePath("/waiter");
  revalidatePath("/kitchen");
}

export async function saveWaiterOpeningBalance(formData: FormData) {
  await requireRole(["CASHIER", "ADMIN"]);

  const waiterId = String(formData.get("waiterId") ?? "").trim();
  const openingAmount = parseAmount(formData.get("openingAmount")) ?? 0;

  if (!waiterId) {
    redirect(buildReturnPath(waiterId, "invalid_opening_amount"));
  }

  let balanceStatus = "opening_saved";

  try {
    const result = await openWaiterBusinessDayShift(waiterId, openingAmount);

    refreshCashierAndWaiterViews();
    balanceStatus =
      result.mode === "created" ? "opening_saved" : "opening_updated";
  } catch (error) {
    console.error("Failed to save opening balance:", error);
    balanceStatus =
      error instanceof Error
        ? error.message.includes("already been closed today")
          ? "shift_already_closed"
          : error.message.includes("Waiter not found")
            ? "waiter_not_found"
            : "opening_failed"
        : "opening_failed";
  }

  redirect(buildReturnPath(waiterId, balanceStatus));
}

export async function closeWaiterBalanceFromCashier(formData: FormData) {
  await requireRole(["CASHIER", "ADMIN"]);

  const waiterId = String(formData.get("waiterId") ?? "").trim();
  const closingAmount = parseAmount(formData.get("closingAmount"));

  if (!waiterId || closingAmount == null) {
    redirect(buildReturnPath(waiterId, "invalid_closing_amount"));
  }

  let balanceStatus = "closing_saved";

  try {
    await closeWaiterBusinessDayShift(waiterId, closingAmount);

    refreshCashierAndWaiterViews();
  } catch (error) {
    console.error("Failed to save closing balance:", error);
    balanceStatus =
      error instanceof Error &&
      error.message.includes("There is no open balance")
        ? "no_open_shift"
        : "closing_failed";
  }

  redirect(buildReturnPath(waiterId, balanceStatus));
}

export async function reopenWaiterBalanceFromCashier(formData: FormData) {
  await requireRole(["CASHIER", "ADMIN"]);

  const waiterId = String(formData.get("waiterId") ?? "").trim();

  if (!waiterId) {
    redirect(buildReturnPath(waiterId, "reopen_failed"));
  }

  let balanceStatus = "reopened_saved";

  try {
    await reopenWaiterBusinessDayShift(waiterId);

    refreshCashierAndWaiterViews();
  } catch (error) {
    console.error("Failed to reopen closing balance:", error);
    balanceStatus =
      error instanceof Error &&
      error.message.includes("There is no closed balance")
        ? "no_closed_shift"
        : "reopen_failed";
  }

  redirect(buildReturnPath(waiterId, balanceStatus));
}
