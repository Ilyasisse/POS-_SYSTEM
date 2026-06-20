"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import {
  getInventoryAlertStatus,
  sendInventoryAlerts,
  setProductInventoryLevel,
  setSupplyInventoryLevel,
} from "@/lib/inventory/inventory";

// Reads a string field from an inventory form and removes extra spaces.
function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

// Reads a quantity field from an inventory form as a non-negative whole number.
function getQuantity(formData: FormData, key: string) {
  return Math.max(0, Math.floor(Number(formData.get(key)) || 0));
}

// Ensures only admins and managers can change inventory.
async function requireInventoryAccess() {
  await requirePermission(PERMISSIONS.INVENTORY_MANAGE);
}

// Redirects back to inventory with a query param that drives the email status popup.
function redirectWithInventoryEmailStatus(
  result: Awaited<ReturnType<typeof sendInventoryAlerts>>,
) {
  revalidatePath("/admin/inventory");
  revalidatePath("/inventory");

  if (result.attempted === 0) {
    redirect("/admin/inventory?inventoryEmail=none");
  }

  if (result.sent > 0) {
    redirect("/admin/inventory?inventoryEmail=sent");
  }

  if (result.skipped) {
    redirect("/admin/inventory?inventoryEmail=skipped");
  }

  redirect("/admin/inventory?inventoryEmail=failed");
}

// Creates a new internal supply row from the admin inventory form.
export async function createSupply(formData: FormData) {
  await requireInventoryAccess();

  // Pulls the submitted supply fields from the create form.
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
  revalidatePath("/inventory");
}

// Sets a menu product's stock quantity and low-stock threshold.
export async function updateProductInventory(formData: FormData) {
  await requireInventoryAccess();

  // Pulls the submitted product inventory fields from the update form.
  const productId = getString(formData, "productId");
  const stockQty = getQuantity(formData, "stockQty");
  const lowStockThreshold = getQuantity(formData, "lowStockThreshold");

  if (!productId) {
    throw new Error("Product is required.");
  }

  // Saves the product stock change and collects any low/out alert.
  // Product movement reasons are no longer passed because product changes do
  // not create InventoryMovement rows after productId was removed from that table.
  const alerts = await prisma.$transaction((tx) =>
    setProductInventoryLevel(
      tx,
      productId,
      stockQty,
      lowStockThreshold,
    ),
  );

  await sendInventoryAlerts(alerts);
  revalidatePath("/admin/inventory");
}

// Adds to or removes from a menu product's stock level.
export async function adjustProductInventory(formData: FormData) {
  await requireInventoryAccess();

  // Pulls the submitted product adjustment fields from the form.
  const productId = getString(formData, "productId");
  const direction = getString(formData, "direction");
  const quantity = getQuantity(formData, "quantity");

  if (!productId) {
    throw new Error("Product is required.");
  }

  if (quantity <= 0) {
    throw new Error("Adjustment quantity must be greater than zero.");
  }

  // Calculates and saves the product adjustment inside one database transaction.
  const alerts = await prisma.$transaction(async (tx) => {
    // Loads the product's current stock so the delta can be applied safely.
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

    // Converts the selected direction into a positive or negative stock change.
    const delta = direction === "remove" ? -quantity : quantity;

    // Only the next product stock values are needed now; supply movement history
    // remains separate and continues to store TAKEN/RESTOCK reasons.
    return setProductInventoryLevel(
      tx,
      productId,
      product.stockQty + delta,
      product.lowStockThreshold,
    );
  });

  await sendInventoryAlerts(alerts);
  revalidatePath("/admin/inventory");
}

// Sets an internal supply's stock quantity and low-stock threshold.
export async function updateSupplyInventory(formData: FormData) {
  await requireInventoryAccess();

  // Pulls the submitted supply inventory fields from the update form.
  const supplyId = getString(formData, "supplyId");
  const stockQty = getQuantity(formData, "stockQty");
  const lowStockThreshold = getQuantity(formData, "lowStockThreshold");

  if (!supplyId) {
    throw new Error("Supply is required.");
  }

  // Saves the supply stock change and collects any low/out alert.
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

  // Sends any supply alert and redirects with popup status.
  const emailResult = await sendInventoryAlerts(alerts);
  redirectWithInventoryEmailStatus(emailResult);
}

// Restocks an internal supply's stock level from the admin inventory page.
export async function adjustSupplyInventory(formData: FormData) {
  await requireInventoryAccess();

  // Pulls the submitted supply adjustment fields from the form.
  const supplyId = getString(formData, "supplyId");
  const quantity = getQuantity(formData, "quantity");
  const note = getString(formData, "note");

  if (!supplyId) {
    throw new Error("Supply is required.");
  }

  if (quantity <= 0) {
    throw new Error("Adjustment quantity must be greater than zero.");
  }

  // Calculates and saves the supply adjustment inside one database transaction.
  const alerts = await prisma.$transaction(async (tx) => {
    // Loads the supply's current stock so the delta can be applied safely.
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

    // Admin supply adjustments are restocks only; taking supplies is handled on /inventory.
    const delta = quantity;

    return setSupplyInventoryLevel(
      tx,
      supplyId,
      supply.stockQty + delta,
      supply.lowStockThreshold,
      "RESTOCK",
      note || "Internal supply restock",
    );
  });

  // Sends any supply alert and redirects with popup status.
  const emailResult = await sendInventoryAlerts(alerts);
  redirectWithInventoryEmailStatus(emailResult);
}
