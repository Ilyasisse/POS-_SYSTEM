"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import {
  sendInventoryAlerts,
  setSupplyInventoryLevel,
} from "@/lib/inventory/inventory";
import { prisma } from "@/lib/prisma";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function getQuantity(formData: FormData, key: string) {
  return Math.max(0, Math.floor(Number(formData.get(key)) || 0));
}

async function requireInventoryUseAccess() {
  await requireRole(["COOK", "Cabitaan"], ["CABITAAN"]);
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
  await requireInventoryUseAccess();

  const supplyId = getString(formData, "supplyId");
  const quantity = getQuantity(formData, "quantity");
  const note = getString(formData, "note");

  if (!supplyId) {
    throw new Error("Supply is required.");
  }

  if (quantity <= 0) {
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
      supply.stockQty - quantity,
      supply.lowStockThreshold,
      "TAKEN",
      note || "Taken from inventory page",
    );
  });

  const emailResult = await sendInventoryAlerts(alerts);
  redirectWithInventoryEmailStatus(emailResult);
}
