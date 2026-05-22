"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/requireRole";

export async function createActiveTableFromAdmin(formData: FormData) {
  await requireRole(["ADMIN", "MANAGER"]);

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
