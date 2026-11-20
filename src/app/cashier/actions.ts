"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { transferOpenTableService } from "@/lib/cashier/table-transfer";

function refreshCashierTableViews() {
  revalidatePath("/cashier");
  revalidatePath("/cashier/order");
  revalidatePath("/manager");
  revalidatePath("/admin/reports");
}

export async function transferOpenTableServiceFromCashier(formData: FormData) {
  await requirePermission(PERMISSIONS.ORDER_MANAGE);
  const sourceTableId = String(formData.get("sourceTableId") ?? "").trim();
  const targetTableId = String(formData.get("targetTableId") ?? "").trim();
  let transferStatus = "table_moved";

  try {
    await transferOpenTableService({ sourceTableId, targetTableId });
    refreshCashierTableViews();
  } catch (error) {
    console.error("Failed to transfer open table service:", error);
    transferStatus = "table_move_failed";
  }

  redirect(`/cashier?transferStatus=${transferStatus}`);
}
