"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/requireRole";
import {
  getInventoryAlertStatus,
  sendInventoryAlerts,
  setProductInventoryLevel,
  setSupplyInventoryLevel,
} from "@/lib/inventory";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function getQuantity(formData: FormData, key: string) {
  return Math.max(0, Math.floor(Number(formData.get(key)) || 0));
}

async function requireInventoryAccess() {
  await requireRole(["ADMIN", "MANAGER"]);
}

export async function createSupply(formData: FormData) {
  await requireInventoryAccess();

  const name = getString(formData, "name");
  const unit = getString(formData, "unit") || "unit";
  const stockQty = getQuantity(formData, "stockQty");
  const lowStockThreshold = getQuantity(formData, "lowStockThreshold");

  if (!name) {
    throw new Error("Supply name is required.");
  }

  await prisma.inventorySupply.create({
    data: {
      name,
      unit,
      stockQty,
      lowStockThreshold,
      inventoryAlertStatus: getInventoryAlertStatus(stockQty, lowStockThreshold),
    },
  });

  revalidatePath("/admin/inventory");
}

export async function updateProductInventory(formData: FormData) {
  await requireInventoryAccess();

  const productId = getString(formData, "productId");
  const stockQty = getQuantity(formData, "stockQty");
  const lowStockThreshold = getQuantity(formData, "lowStockThreshold");

  if (!productId) {
    throw new Error("Product is required.");
  }

  const alerts = await prisma.$transaction((tx) =>
    setProductInventoryLevel(
      tx,
      productId,
      stockQty,
      lowStockThreshold,
      "SET",
      "Inventory page update",
    ),
  );

  await sendInventoryAlerts(alerts);
  revalidatePath("/admin/inventory");
}

export async function adjustProductInventory(formData: FormData) {
  await requireInventoryAccess();

  const productId = getString(formData, "productId");
  const direction = getString(formData, "direction");
  const quantity = getQuantity(formData, "quantity");
  const note = getString(formData, "note");

  if (!productId) {
    throw new Error("Product is required.");
  }

  if (quantity <= 0) {
    throw new Error("Adjustment quantity must be greater than zero.");
  }

  const alerts = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: {
        stockQty: true,
        lowStockThreshold: true,
      },
    });

    if (!product) {
      throw new Error("Product not found.");
    }

    const delta = direction === "remove" ? -quantity : quantity;

    return setProductInventoryLevel(
      tx,
      productId,
      product.stockQty + delta,
      product.lowStockThreshold,
      direction === "remove" ? "MANUAL_REMOVE" : "MANUAL_ADD",
      note || "Inventory page adjustment",
    );
  });

  await sendInventoryAlerts(alerts);
  revalidatePath("/admin/inventory");
}

export async function updateSupplyInventory(formData: FormData) {
  await requireInventoryAccess();

  const supplyId = getString(formData, "supplyId");
  const stockQty = getQuantity(formData, "stockQty");
  const lowStockThreshold = getQuantity(formData, "lowStockThreshold");

  if (!supplyId) {
    throw new Error("Supply is required.");
  }

  const alerts = await prisma.$transaction((tx) =>
    setSupplyInventoryLevel(
      tx,
      supplyId,
      stockQty,
      lowStockThreshold,
      "SET",
      "Inventory page update",
    ),
  );

  await sendInventoryAlerts(alerts);
  revalidatePath("/admin/inventory");
}

export async function adjustSupplyInventory(formData: FormData) {
  await requireInventoryAccess();

  const supplyId = getString(formData, "supplyId");
  const direction = getString(formData, "direction");
  const quantity = getQuantity(formData, "quantity");
  const note = getString(formData, "note");

  if (!supplyId) {
    throw new Error("Supply is required.");
  }

  if (quantity <= 0) {
    throw new Error("Adjustment quantity must be greater than zero.");
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

    const isTaken = direction === "taken" || direction === "remove";
    const delta = isTaken ? -quantity : quantity;

    return setSupplyInventoryLevel(
      tx,
      supplyId,
      supply.stockQty + delta,
      supply.lowStockThreshold,
      isTaken ? "TAKEN" : "RESTOCK",
      note || (isTaken ? "Taken during the day" : "Internal supply restock"),
    );
  });

  await sendInventoryAlerts(alerts);
  revalidatePath("/admin/inventory");
}
