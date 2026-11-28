"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { validFloorPosition } from "@/lib/tables/floor-layout";

export async function createActiveTableFromAdmin(formData: FormData) {
  await requirePermission(PERMISSIONS.TABLE_MANAGE);

  const tableName = String(formData.get("tableName") ?? "").trim();

  if (!tableName) {
    redirect("/admin/tables?tableStatus=invalid_table");
  }

  let tableStatus = "table_created";

  try {
    await prisma.table.create({
      data: {
        name: tableName,
        isActive: true,
      },
    });

    revalidatePath("/admin/tables");
    revalidatePath("/cashier");
    revalidatePath("/cashier/order");
    revalidatePath("/manager");
  } catch (error) {
    console.error("Failed to create table:", error);
    tableStatus =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
        ? "duplicate_table"
        : "table_create_failed";
  }

  redirect(`/admin/tables?tableStatus=${tableStatus}`);
}

export async function moveTableOnFloorAction(input: {
  id: string;
  x: number;
  y: number;
  expectedX: number | null;
  expectedY: number | null;
}) {
  const actor = await requirePermission(PERMISSIONS.TABLE_MANAGE);
  if (!input.id || !validFloorPosition({ x: input.x, y: input.y }))
    return {
      ok: false as const,
      message: "Choose a position inside the floor plan.",
    };
  if (
    (input.expectedX !== null || input.expectedY !== null) &&
    (input.expectedX === null ||
      input.expectedY === null ||
      !validFloorPosition({ x: input.expectedX, y: input.expectedY }))
  )
    return {
      ok: false as const,
      message: "Refresh the floor plan and try again.",
    };
  const moved = await prisma.$transaction(async (tx) => {
    const result = await tx.table.updateMany({
      where: { id: input.id, floorX: input.expectedX, floorY: input.expectedY },
      data: { floorX: input.x, floorY: input.y },
    });
    if (result.count !== 1) return false;
    await tx.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "table.floor_position.changed",
        entityType: "Table",
        entityId: input.id,
        previousValue: { x: input.expectedX, y: input.expectedY },
        newValue: { x: input.x, y: input.y },
      },
    });
    return true;
  });
  if (!moved)
    return {
      ok: false as const,
      message: "This table moved in another session. Refresh the floor plan.",
    };
  revalidatePath("/admin/tables");
  return { ok: true as const };
}
