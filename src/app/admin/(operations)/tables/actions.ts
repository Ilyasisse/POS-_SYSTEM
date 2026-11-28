"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import {
  parseTableMetadata,
  type TableMetadata,
} from "@/lib/tables/table-metadata";

function refreshTableViews() {
  revalidatePath("/admin/tables");
  revalidatePath("/cashier");
  revalidatePath("/cashier/order");
  revalidatePath("/manager");
}

export async function createActiveTableFromAdmin(formData: FormData) {
  await requirePermission(PERMISSIONS.TABLE_MANAGE);

  let table: TableMetadata;
  try {
    table = parseTableMetadata({
      name: formData.get("tableName"),
      capacity: formData.get("capacity"),
      section: formData.get("section"),
      isActive: "active",
    });
  } catch {
    redirect("/admin/tables?tableStatus=invalid_table");
  }

  let tableStatus = "table_created";

  try {
    await prisma.table.create({
      data: {
        ...table,
      },
    });

    refreshTableViews();
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

export async function updateTableMetadata(formData: FormData) {
  await requirePermission(PERMISSIONS.TABLE_MANAGE);

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    redirect("/admin/tables?tableStatus=table_not_found");
  }

  let table: TableMetadata;
  try {
    table = parseTableMetadata({
      name: formData.get("name"),
      capacity: formData.get("capacity"),
      section: formData.get("section"),
      isActive: formData.get("isActive"),
    });
  } catch {
    redirect("/admin/tables?tableStatus=invalid_table");
  }

  let tableStatus = "table_updated";
  try {
    const result = await prisma.table.updateMany({
      where: {
        id,
        ...(table.isActive
          ? {}
          : { orders: { none: { status: "OPEN" } } }),
      },
      data: table,
    });

    if (result.count !== 1) {
      const existing = await prisma.table.findUnique({
        where: { id },
        select: { id: true },
      });
      tableStatus = existing ? "occupied_table" : "table_not_found";
    } else {
      refreshTableViews();
    }
  } catch (error) {
    console.error("Failed to update table metadata:", error);
    tableStatus =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
        ? "duplicate_table"
        : "table_update_failed";
  }

  redirect(`/admin/tables?tableStatus=${tableStatus}`);
}
