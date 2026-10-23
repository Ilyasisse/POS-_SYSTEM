"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import {
  fireHeldKitchenRound,
  KitchenTicketMutationError,
} from "@/lib/kitchen/kitchen-tickets";

export async function fireHeldCourseAction(formData: FormData) {
  const actor = await requirePermission(PERMISSIONS.ORDER_MANAGE);
  const orderId = String(formData.get("orderId") ?? "").trim();
  if (!orderId) redirect("/cashier?orderStatus=fire_failed");

  try {
    await fireHeldKitchenRound({ orderId, actorUserId: actor.id });
  } catch (error) {
    if (!(error instanceof KitchenTicketMutationError)) {
      console.error("Fire kitchen course failed:", error);
    }
    redirect("/cashier?orderStatus=fire_failed");
  }
  revalidatePath("/cashier");
  revalidatePath("/kitchen");
  redirect("/cashier?orderStatus=course_fired");
}
