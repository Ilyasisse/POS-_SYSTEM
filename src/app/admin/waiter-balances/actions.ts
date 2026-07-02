"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { parseCurrencyAmount } from "@/lib/currency/amount-input";
import {
  initializeWaiterBalance,
  parseBusinessDateKey,
  saveWaiterSettlement,
} from "@/lib/waiter/waiter-balance-ledger";

function returnPath(date: string, status: string, showInactive: boolean) {
  const params = new URLSearchParams({ status });
  if (date) params.set("date", date);
  if (showInactive) params.set("showInactive", "1");
  return `/admin/waiter-balances?${params.toString()}`;
}

function errorStatus(error: unknown) {
  if (!(error instanceof Error)) return "save_failed";
  if (error.message.includes("already locked")) return "already_initialized";
  if (error.message.includes("July 1")) return "before_activation";
  if (error.message.includes("Future")) return "future_date";
  if (error.message.includes("Waiter not found")) return "waiter_not_found";
  if (error.message.includes("Inactive waiters")) return "inactive_waiter";
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
  const showInactive = formData.get("showInactive") === "1";
  const openingBalance = parseCurrencyAmount(formData.get("openingBalance"), {
    allowNegative: true,
    requireNonPositive: true,
  });

  if (!waiterId || openingBalance == null || openingBalance > 0) {
    redirect(returnPath(businessDateKey, "invalid_initial_balance", showInactive));
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

  redirect(returnPath(businessDateKey, status, showInactive));
}

export async function saveWaiterDailySettlement(formData: FormData) {
  const currentUser = await requirePermission(
    PERMISSIONS.WAITER_BALANCE_ADMIN,
  );
  const waiterId = String(formData.get("waiterId") ?? "").trim();
  const businessDateKey = String(formData.get("businessDate") ?? "").trim();
  const showInactive = formData.get("showInactive") === "1";
  const reportedSales = parseCurrencyAmount(formData.get("reportedSales"));
  const endDayAmount = parseCurrencyAmount(formData.get("endDayAmount"));

  if (
    !waiterId ||
    !parseBusinessDateKey(businessDateKey) ||
    reportedSales == null ||
    reportedSales < 0 ||
    endDayAmount == null ||
    endDayAmount < 0
  ) {
    redirect(returnPath(businessDateKey, "invalid_settlement", showInactive));
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

  redirect(returnPath(businessDateKey, status, showInactive));
}
