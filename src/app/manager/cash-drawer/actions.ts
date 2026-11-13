"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { parseCashDrawerMovement } from "@/lib/cashier/cash-drawer-movement";
import { prisma } from "@/lib/prisma";

export async function recordCashDrawerMovement(formData: FormData) {
  const actor = await requirePermission(PERMISSIONS.ADMIN_ACCESS);
  const movement = parseCashDrawerMovement({
    direction: String(formData.get("direction") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    reason: String(formData.get("reason") ?? ""),
    idempotencyKey: String(formData.get("idempotencyKey") ?? ""),
  });
  if (!movement) redirect("/manager/cash-drawer?status=invalid");

  try {
    await prisma.$transaction(async (tx) => {
      const recorded = await tx.cashDrawerMovement.create({
        data: { ...movement, recordedById: actor.id },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "cash_drawer.movement.recorded",
          entityType: "CashDrawerMovement",
          entityId: recorded.id,
          reason: movement.reason,
          newValue: {
            direction: recorded.direction,
            amount: recorded.amount.toString(),
          },
        },
      });
    });
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== "P2002"
    )
      throw error;
    const previous = await prisma.cashDrawerMovement.findUnique({
      where: { idempotencyKey: movement.idempotencyKey },
      select: { recordedById: true },
    });
    if (!previous || previous.recordedById !== actor.id) throw error;
  }

  revalidatePath("/manager/cash-drawer");
  redirect("/manager/cash-drawer?status=recorded");
}
