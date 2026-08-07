"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { createDailySalaryRate } from "@/lib/daily-cash/service";

export async function saveSalaryRateAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.DAILY_CASH_MANAGE);
  await createDailySalaryRate({ amount: Number(formData.get("amount")), effectiveDate: String(formData.get("effectiveDate") ?? ""), userId: user.id });
  revalidatePath("/admin/daily-cash");
  revalidatePath("/admin/daily-cash/settings");
}
