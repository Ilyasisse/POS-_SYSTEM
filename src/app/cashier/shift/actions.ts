"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { parseCashCount } from "@/lib/cashier/cash-count";
import { prisma } from "@/lib/prisma";

const shiftUrl = "/cashier/shift";
function finish(status: string): never {
  revalidatePath(shiftUrl);
  redirect(`${shiftUrl}?status=${status}`);
}

export async function openRegisterShift(formData: FormData) {
  const staff = await requirePermission(PERMISSIONS.PAYMENT_TAKE);
  const openingCash = parseCashCount(String(formData.get("openingCash") ?? ""));
  if (openingCash === null) finish("invalid");

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.cashierRegisterShift.findFirst({
        where: { cashierId: staff.id, closedAt: null },
        select: { id: true },
      });
      if (existing) return;
      const shift = await tx.cashierRegisterShift.create({
        data: { cashierId: staff.id, openingCash },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: staff.id,
          action: "cashier.shift.opened",
          entityType: "CashierRegisterShift",
          entityId: shift.id,
          newValue: { openingCash: shift.openingCash.toString() },
        },
      });
    });
  } catch (error) {
    // A second tab can submit after our existence check. The partial unique
    // index ensures exactly one open shift per cashier.
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== "P2002"
    )
      throw error;
  }
  finish("opened");
}

export async function closeRegisterShift(formData: FormData) {
  const staff = await requirePermission(PERMISSIONS.PAYMENT_TAKE);
  const closingCash = parseCashCount(String(formData.get("closingCash") ?? ""));
  const closingNote = String(formData.get("closingNote") ?? "").trim();
  const shiftId = String(formData.get("shiftId") ?? "");
  if (closingCash === null || closingNote.length > 500 || !shiftId)
    finish("invalid");

  const closed = await prisma.$transaction(async (tx) => {
    const shift = await tx.cashierRegisterShift.findFirst({
      where: { id: shiftId, cashierId: staff.id, closedAt: null },
    });
    if (!shift) return false;
    const now = new Date();
    const update = await tx.cashierRegisterShift.updateMany({
      where: { id: shiftId, cashierId: staff.id, closedAt: null },
      data: { closedAt: now, closingCash, closingNote: closingNote || null },
    });
    if (update.count !== 1) return false;
    await tx.auditLog.create({
      data: {
        actorUserId: staff.id,
        action: "cashier.shift.closed",
        entityType: "CashierRegisterShift",
        entityId: shift.id,
        previousValue: { openingCash: shift.openingCash.toString() },
        newValue: { closingCash, closingNote: closingNote || null },
      },
    });
    return true;
  });
  finish(closed ? "closed" : "already-closed");
}
