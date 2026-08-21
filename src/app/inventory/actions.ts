"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import {
  sendInventoryAlerts,
  setSupplyInventoryLevel,
} from "@/lib/inventory/inventory";
import { prisma } from "@/lib/prisma";
import { decimalQuantity } from "@/lib/inventory/inventory-domain";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function getQuantity(formData: FormData, key: string) {
  return decimalQuantity(String(formData.get(key) ?? "0"), key);
}

async function requireInventoryUseAccess() {
  return requirePermission(PERMISSIONS.INVENTORY_MANAGE, {
    stations: ["CABITAAN"],
  });
}
function redirectWithInventoryEmailStatus(
  result: Awaited<ReturnType<typeof sendInventoryAlerts>>,
) {
  revalidatePath("/inventory");
  revalidatePath("/admin/inventory");

  if (result.attempted === 0) {
    redirect("/inventory?inventoryEmail=none");
  }

  if (result.sent > 0) {
    redirect("/inventory?inventoryEmail=sent");
  }

  if (result.skipped) {
    redirect("/inventory?inventoryEmail=skipped");
  }

  redirect("/inventory?inventoryEmail=failed");
}

export async function takeSupplyInventory(formData: FormData) {
  const user = await requireInventoryUseAccess();

  const supplyId = getString(formData, "supplyId");
  const quantity = getQuantity(formData, "quantity");
  const note = getString(formData, "note");

  if (!supplyId) {
    throw new Error("Supply is required.");
  }

  if (quantity.lte(0)) {
    throw new Error("Take quantity must be greater than zero.");
  }

  const alerts = await prisma.$transaction(async (tx) => {
    const supply = await tx.inventorySupply.findUnique({
      where: { id: supplyId },
      select: {
        stockQty: true,
        lowStockThreshold: true,
      },
    });

    if (!supply) {
      throw new Error("Supply not found.");
    }

    return setSupplyInventoryLevel(
      tx,
      supplyId,
      supply.stockQty.sub(quantity),
      supply.lowStockThreshold,
      "TAKEN",
      note || "Taken from inventory page",
      user.id,
    );
  });

  const emailResult = await sendInventoryAlerts(alerts);
  redirectWithInventoryEmailStatus(emailResult);
}
