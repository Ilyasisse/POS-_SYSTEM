"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import {
  createShiftHandover,
  resolveShiftHandover,
} from "@/lib/operations/shift-handover";
import { HandoverValidationError } from "@/lib/operations/shift-handover-rules";

export async function createHandoverAction(formData: FormData) {
  const actor = await requirePermission(PERMISSIONS.ORDER_MANAGE);
  let status = "created";
  try {
    await createShiftHandover({
      title: formData.get("title"),
      details: formData.get("details"),
      requestToken: formData.get("requestToken"),
      actorUserId: actor.id,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      status = "duplicate";
    } else if (error instanceof HandoverValidationError) {
      status = "invalid";
    } else {
      console.error("Handover create failed:", error);
      status = "failed";
    }
  }
  revalidatePath("/cashier/handover");
  redirect(`/cashier/handover?status=${status}`);
}

export async function resolveHandoverAction(formData: FormData) {
  const actor = await requirePermission(PERMISSIONS.ORDER_MANAGE);
  let status = "resolved";
  try {
    await resolveShiftHandover({
      id: String(formData.get("id") ?? ""),
      resolutionNote: formData.get("resolutionNote"),
      actorUserId: actor.id,
    });
  } catch (error) {
    if (error instanceof HandoverValidationError) {
      status = "stale";
    } else {
      console.error("Handover resolution failed:", error);
      status = "failed";
    }
  }
  revalidatePath("/cashier/handover");
  redirect(`/cashier/handover?status=${status}`);
}
