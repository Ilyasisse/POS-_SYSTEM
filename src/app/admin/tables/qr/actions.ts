"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";

function tableQrRedirect(status: string) {
  redirect(`/admin/tables/qr?status=${status}`);
}

export async function setTableQrOrdering(formData: FormData) {
  await requirePermission(PERMISSIONS.TABLE_MANAGE);

  const tableId = String(formData.get("tableId") ?? "").trim();
  const enabled = formData.get("enabled") === "true";
  if (!tableId) tableQrRedirect("invalid_table");

  let updated = false;
  try {
    const result = await prisma.table.updateMany({
      where: { id: tableId, isActive: true },
      data: { qrOrderingEnabled: enabled },
    });
    updated = result.count > 0;
  } catch (error) {
    console.error("Failed to update table QR ordering:", error);
    tableQrRedirect("update_failed");
  }
  if (!updated) tableQrRedirect("invalid_table");

  revalidatePath("/admin/tables/qr");
  tableQrRedirect(enabled ? "enabled" : "disabled");
}

export async function rotateTableQrCode(formData: FormData) {
  await requirePermission(PERMISSIONS.TABLE_MANAGE);

  const tableId = String(formData.get("tableId") ?? "").trim();
  if (!tableId) tableQrRedirect("invalid_table");

  let updated = false;
  try {
    const result = await prisma.table.updateMany({
      where: { id: tableId, isActive: true },
      data: {
        qrOrderingEnabled: true,
        qrTokenVersion: { increment: 1 },
      },
    });
    updated = result.count > 0;
  } catch (error) {
    console.error("Failed to replace table QR code:", error);
    tableQrRedirect("update_failed");
  }
  if (!updated) tableQrRedirect("invalid_table");

  revalidatePath("/admin/tables/qr");
  tableQrRedirect("rotated");
}
