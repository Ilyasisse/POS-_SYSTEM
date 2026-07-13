"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { parseCurrencyAmount } from "@/lib/currency/amount-input";
import {
  closeWaiterBusinessDayShift,
  openWaiterBusinessDayShift,
  reopenWaiterBusinessDayShift,
} from "@/lib/waiter/waiter-shifts";

function buildReturnPath(waiterId: string, balanceStatus: string) {
  const params = new URLSearchParams();

  if (waiterId) params.set("waiterId", waiterId);
  if (balanceStatus) params.set("balanceStatus", balanceStatus);

  return params.size > 0 ? `/manager?${params.toString()}` : "/manager";
}

function refreshManagerViews() {
  revalidatePath("/manager");
  revalidatePath("/manager/reports");
  revalidatePath("/manager/waiter-orders");
  revalidatePath("/admin/reports");
  revalidatePath("/cashier");
  revalidatePath("/waiter");
  revalidatePath("/kitchen");
}

export async function saveWaiterOpeningBalance(formData: FormData) {
  await requirePermission(PERMISSIONS.ORDER_MANAGE);

  const waiterId = String(formData.get("waiterId") ?? "").trim();
  const openingAmount =
    parseCurrencyAmount(formData.get("openingAmount"), {
      allowNegative: true,
    }) ?? 0;

  if (!waiterId) {
    redirect(buildReturnPath(waiterId, "invalid_opening_amount"));
  }

  let balanceStatus = "opening_saved";

  try {
    const result = await openWaiterBusinessDayShift(waiterId, openingAmount);

    refreshManagerViews();
    balanceStatus =
      result.mode === "created" ? "opening_saved" : "opening_updated";
  } catch (error) {
    console.error("Failed to save opening balance:", error);
    balanceStatus =
      error instanceof Error
        ? error.message.includes("already been closed today")
          ? "shift_already_closed"
          : error.message.includes("one-time opening balance")
            ? "balance_not_initialized"
          : error.message.includes("Waiter not found")
            ? "waiter_not_found"
            : "opening_failed"
        : "opening_failed";
  }

  redirect(buildReturnPath(waiterId, balanceStatus));
}

export async function closeWaiterBalanceFromManager(formData: FormData) {
  const currentUser = await requirePermission(PERMISSIONS.ORDER_MANAGE);

  const waiterId = String(formData.get("waiterId") ?? "").trim();
  const closingAmount = parseCurrencyAmount(formData.get("closingAmount"));

  if (!waiterId || closingAmount == null) {
    redirect(buildReturnPath(waiterId, "invalid_closing_amount"));
  }

  let balanceStatus = "closing_saved";

  try {
    await closeWaiterBusinessDayShift(
      waiterId,
      closingAmount,
      new Date(),
      currentUser.id,
    );
    refreshManagerViews();
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

export async function reopenWaiterBalanceFromManager(formData: FormData) {
  await requirePermission(PERMISSIONS.ORDER_MANAGE);

  const waiterId = String(formData.get("waiterId") ?? "").trim();

  if (!waiterId) {
    redirect(buildReturnPath(waiterId, "reopen_failed"));
  }

  let balanceStatus = "reopened_saved";

  try {
    await reopenWaiterBusinessDayShift(waiterId);
    refreshManagerViews();
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
