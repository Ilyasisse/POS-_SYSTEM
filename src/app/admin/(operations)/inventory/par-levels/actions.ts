"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { parseParLevel } from "@/lib/inventory/par-levels";

export async function updateSupplyParLevelAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.INVENTORY_MANAGE);
  const supplyId = String(formData.get("supplyId") ?? "").trim();
  if (!supplyId) redirect("/admin/inventory/par-levels?notice=missing");
  let notice = "saved";
  try {
    await prisma.$transaction(async (tx) => {
      const supply = await tx.inventorySupply.findFirst({
        where: { id: supplyId, isActive: true },
        select: { parLevel: true, lowStockThreshold: true },
      });
      if (!supply) throw new Error("missing");
      const parsed = parseParLevel(
        String(formData.get("parLevel") ?? ""),
        supply.lowStockThreshold,
      );
      if (!parsed.ok) throw new Error("invalid");
      const result = await tx.inventorySupply.updateMany({
        where: {
          id: supplyId,
          isActive: true,
          lowStockThreshold: supply.lowStockThreshold,
          parLevel: supply.parLevel,
        },
        data: { parLevel: parsed.value },
      });
      if (result.count !== 1) throw new Error("changed");
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "inventory.supply.par_level.updated",
          entityType: "InventorySupply",
          entityId: supplyId,
          previousValue: { parLevel: supply.parLevel?.toString() ?? null },
          newValue: { parLevel: parsed.value?.toString() ?? null },
        },
      });
    });
  } catch (error) {
    notice =
      error instanceof Error &&
      ["missing", "invalid", "changed"].includes(error.message)
        ? error.message
        : "failed";
  }
  revalidatePath("/admin/inventory/par-levels");
  redirect(`/admin/inventory/par-levels?notice=${notice}`);
}
