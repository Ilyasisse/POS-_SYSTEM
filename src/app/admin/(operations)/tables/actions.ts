"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";

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

export async function updateTableCleaningStatus(formData: FormData) {
  await requirePermission(PERMISSIONS.CLEANING_COMPLETE);
  const tableId = String(formData.get("tableId") ?? "").trim();
  const nextStatus = String(formData.get("nextStatus") ?? "");
  if (!tableId || !["clean", "needs_cleaning"].includes(nextStatus)) {
    redirect("/admin/tables?tableStatus=invalid_cleaning_action");
  }

  const needsCleaning = nextStatus === "needs_cleaning";
  let tableStatus = "cleaning_failed";
  try {
    const result = await prisma.table.updateMany({
      where: {
        id: tableId,
        isActive: true,
        needsCleaning: !needsCleaning,
        orders: { none: { status: "OPEN", type: "DINE_IN" } },
      },
      data: { needsCleaning },
    });
    if (result.count) {
      tableStatus = needsCleaning ? "table_needs_cleaning" : "table_cleaned";
      revalidatePath("/admin/tables");
      revalidatePath("/cashier/order");
    } else {
      tableStatus = "cleaning_unavailable";
    }
  } catch (error) {
    console.error("Failed to update table cleaning status:", error);
  }
  redirect(`/admin/tables?tableStatus=${tableStatus}`);
}
