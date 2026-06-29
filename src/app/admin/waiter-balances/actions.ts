"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import {
  initializeWaiterBalance,
  parseBusinessDateKey,
  saveWaiterSettlement,
} from "@/lib/waiter/waiter-balance-ledger";

function parseAmount(value: FormDataEntryValue | null) {
  const input = String(value ?? "").trim();
  if (!input) return null;
  const amount = Number(input);
  return Number.isFinite(amount) ? amount : null;
}

function returnPath(date: string, status: string) {
  const params = new URLSearchParams({ status });
  if (date) params.set("date", date);
  return `/admin/waiter-balances?${params.toString()}`;
}

function errorStatus(error: unknown) {
  if (!(error instanceof Error)) return "save_failed";
  if (error.message.includes("already locked")) return "already_initialized";
  if (error.message.includes("July 1")) return "before_activation";
  if (error.message.includes("Future")) return "future_date";
  if (error.message.includes("Waiter not found")) return "waiter_not_found";
  if (error.message.includes("one-time opening balance")) {
    return "initialization_required";
  }
  return "save_failed";
}

function refreshBalanceViews() {
  revalidatePath("/admin/waiter-balances");
  revalidatePath("/admin/reports");
  revalidatePath("/manager");
  revalidatePath("/waiter");
}

export async function initializeWaiterOpeningBalance(formData: FormData) {
  const currentUser = await requirePermission(
    PERMISSIONS.WAITER_BALANCE_ADMIN,
  );
  const waiterId = String(formData.get("waiterId") ?? "").trim();
  const businessDateKey = String(formData.get("businessDate") ?? "").trim();
  const openingBalance = parseAmount(formData.get("openingBalance"));

  if (!waiterId || openingBalance == null || openingBalance > 0) {
    redirect(returnPath(businessDateKey, "invalid_initial_balance"));
  }

  let status = "initialized";
  try {
    await initializeWaiterBalance({
      waiterId,
      openingBalance,
      createdByUserId: currentUser.id,
    });
    refreshBalanceViews();
  } catch (error) {
    console.error("Failed to initialize waiter balance:", error);
    status = errorStatus(error);
  }

  redirect(returnPath(businessDateKey, status));
}

export async function saveWaiterDailySettlement(formData: FormData) {
  const currentUser = await requirePermission(
    PERMISSIONS.WAITER_BALANCE_ADMIN,
  );
  const waiterId = String(formData.get("waiterId") ?? "").trim();
  const businessDateKey = String(formData.get("businessDate") ?? "").trim();
  const reportedSales = parseAmount(formData.get("reportedSales"));
  const endDayAmount = parseAmount(formData.get("endDayAmount"));

  if (
    !waiterId ||
    !parseBusinessDateKey(businessDateKey) ||
    reportedSales == null ||
    reportedSales < 0 ||
    endDayAmount == null ||
    endDayAmount < 0
  ) {
    redirect(returnPath(businessDateKey, "invalid_settlement"));
  }

  let status = "settlement_saved";
  try {
    await saveWaiterSettlement({
      waiterId,
      businessDateKey,
      reportedSales,
      endDayAmount,
      settledByUserId: currentUser.id,
    });
    refreshBalanceViews();
  } catch (error) {
    console.error("Failed to save waiter settlement:", error);
    status = errorStatus(error);
  }

  redirect(returnPath(businessDateKey, status));
}
