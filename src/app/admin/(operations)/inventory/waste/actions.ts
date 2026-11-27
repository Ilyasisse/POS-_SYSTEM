"use server";

import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { sendInventoryAlerts } from "@/lib/inventory/inventory";
import { recordSupplyWaste } from "@/lib/inventory/record-waste";
import { wasteInputSchema } from "@/lib/inventory/waste-input";

export type WasteFormState = {
  ok: boolean;
  message: string;
  errors?: Record<string, string>;
} | null;

export async function submitSupplyWaste(
  _previous: WasteFormState,
  formData: FormData,
): Promise<WasteFormState> {
  const user = await requirePermission(PERMISSIONS.INVENTORY_MANAGE);
  const parsed = wasteInputSchema.safeParse({
    supplyId: formData.get("supplyId"),
    type: formData.get("type"),
    quantity: formData.get("quantity"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the highlighted fields.",
      errors: Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).map(
          ([key, messages]) => [key, messages?.[0] ?? "Invalid value."],
        ),
      ),
    };
  }
  let alerts;
  try {
    alerts = await recordSupplyWaste(parsed.data, user.id);
  } catch (error) {
    if (
      error instanceof Error &&
      /Quantity exceeds|no longer available|canonical unit/.test(error.message)
    ) {
      return {
        ok: false,
        message: error.message,
        errors: {
          [error.message.startsWith("Quantity") ? "quantity" : "supplyId"]:
            error.message,
        },
      };
    }
    throw error;
  }
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/inventory/waste");
  revalidatePath("/inventory");
  const delivery = await sendInventoryAlerts(alerts);
  return {
    ok: true,
    message:
      delivery.failed > 0 || delivery.skipped
        ? "Waste recorded. Low-stock alert email needs attention; check email settings and logs."
        : "Waste recorded and stock updated.",
  };
}
