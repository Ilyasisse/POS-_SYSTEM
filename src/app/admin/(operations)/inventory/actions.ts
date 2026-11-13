"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { decimalQuantity } from "@/lib/inventory/inventory-domain";
import {
  classifySupplyUnit,
  supplyInputQuantity,
  supplyStockUnit,
} from "@/lib/inventory/supply-units";
import { Prisma } from "@prisma/client";
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

// Reads a quantity field as a Decimal; fractional canonical quantities are valid.
function getQuantity(formData: FormData, key: string) {
  return decimalQuantity(String(formData.get(key) ?? "0"), key);
}

// Ensures only admins and managers can change inventory.
async function requireInventoryAccess() {
  return requirePermission(PERMISSIONS.INVENTORY_MANAGE);
}
type SupplyFormField = "name" | "unit" | "stockQty" | "lowStockThreshold" | "quantity";
export type SupplyFormResult =
  | { ok: true; email?: "sent" | "failed" | "skipped" }
  | { ok: false; error: string; field?: SupplyFormField };

function readSupplyQuantity(
  formData: FormData,
  field: "stockQty" | "lowStockThreshold" | "quantity",
  factor: Prisma.Decimal,
  defaultToZero = false,
) {
  const label = {
    stockQty: "Stock quantity",
    lowStockThreshold: "Low-stock threshold",
    quantity: "Restock quantity",
  }[field];
  const value = getString(formData, field);
  try {
    return {
      ok: true,
      quantity: supplyInputQuantity(defaultToZero && !value ? "0" : value, factor, {
        positive: field === "quantity",
        field: label,
      }),
    } as const;
  } catch (error) {
    return {
      ok: false,
      field,
      error: error instanceof Error ? error.message : "Enter a valid quantity.",
    } as const;
  }
}

export async function createSupply(formData: FormData): Promise<SupplyFormResult> {
  await requireInventoryAccess();
  const name = getString(formData, "name");
  const unit = getString(formData, "unit") || "unit";
  if (!name) return { ok: false, field: "name", error: "Enter a supply name." };

  const mapping = classifySupplyUnit(unit, formData.get("countAsEntered") === "yes");
  if (!mapping.canonicalUnit) {
    return {
      ok: false,
      field: "unit",
      error: "Choose a known unit or confirm that each entered unit counts as one.",
    };
  }

  const stock = readSupplyQuantity(formData, "stockQty", mapping.factor, true);
  if (!stock.ok) return stock;
  const threshold = readSupplyQuantity(formData, "lowStockThreshold", mapping.factor, true);
  if (!threshold.ok) return threshold;

  try {
    await prisma.inventorySupply.create({
      data: {
        name,
        unit,
        stockQty: stock.quantity,
        lowStockThreshold: threshold.quantity,
        canonicalUnit: mapping.canonicalUnit,
        quantityCoverage: mapping.coverage,
        inventoryAlertStatus: getInventoryAlertStatus(
          stock.quantity,
          threshold.quantity,
        ),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        ok: false,
        field: "name",
        error: "A supply with this name and unit already exists.",
      };
    }
    console.error("Failed to create supply:", error);
    return { ok: false, error: "Could not create the supply. Try again." };
  }

  revalidatePath("/admin/inventory");
  revalidatePath("/inventory");
  return { ok: true };
}

// Sets a menu product's stock quantity and low-stock threshold.
async function updateProductInventory(formData: FormData) {
  const user = await requireInventoryAccess();

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
      user.id,
    ),
  );

  await sendInventoryAlerts(alerts);
  revalidatePath("/admin/inventory");
}

// Adds to or removes from a menu product's stock level.
async function adjustProductInventory(formData: FormData) {
  const user = await requireInventoryAccess();

  // Pulls the submitted product adjustment fields from the form.
  const productId = getString(formData, "productId");
  const direction = getString(formData, "direction");
  const quantity = getQuantity(formData, "quantity");

  if (!productId) {
    throw new Error("Product is required.");
  }

  if (quantity.lte(0)) {
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
    const delta = direction === "remove" ? quantity.negated() : quantity;

    // Only the next product stock values are needed now; supply movement history
    // remains separate and continues to store TAKEN/RESTOCK reasons.
    return setProductInventoryLevel(
      tx,
      productId,
      product.stockQty.add(delta),
      product.lowStockThreshold,
      user.id,
      "Administrator product stock adjustment",
    );
  });

  await sendInventoryAlerts(alerts);
  revalidatePath("/admin/inventory");
}

async function saveSupplyInventory(
  formData: FormData,
  reason: "SET" | "RESTOCK",
): Promise<SupplyFormResult> {
  const user = await requireInventoryAccess();
  const supplyId = getString(formData, "supplyId");
  if (!supplyId) return { ok: false, error: "Supply is required." };

  let result;
  try {
    result = await prisma.$transaction(
      async (tx) => {
        const supply = await tx.inventorySupply.findUnique({ where: { id: supplyId } });
        if (!supply?.isActive)
          return { ok: false, error: "This supply is no longer available." } as const;
        if (!supply.canonicalUnit)
          return { ok: false, error: "Configure the stock unit before changing stock." } as const;

        const stockUnit = supplyStockUnit(supply);
        const unitToken = formData.get("stockUnit");
        if (unitToken !== null && unitToken !== stockUnit.token) {
          return { ok: false, error: "The stock unit changed. Refresh and try again." } as const;
        }
        // Earlier forms submitted canonical quantities.
        const factor = unitToken === null ? new Prisma.Decimal(1) : stockUnit.factor;
        const stock = readSupplyQuantity(
          formData,
          reason === "SET" ? "stockQty" : "quantity",
          factor,
        );
        if (!stock.ok) return stock;
        const threshold =
          reason === "SET"
            ? readSupplyQuantity(formData, "lowStockThreshold", factor)
            : ({ ok: true, quantity: supply.lowStockThreshold } as const);
        if (!threshold.ok) return threshold;

        const nextStock = reason === "SET" ? stock.quantity : supply.stockQty.add(stock.quantity);
        const note =
          reason === "SET"
            ? "Inventory page update"
            : getString(formData, "note") || "Internal supply restock";
        return {
          ok: true,
          alerts: await setSupplyInventoryLevel(
            tx,
            supplyId,
            nextStock,
            threshold.quantity,
            reason,
            note,
            user.id,
          ),
        } as const;
      },
      { isolationLevel: "RepeatableRead" },
    );
  } catch (error) {
    console.error("Failed to save supply inventory:", error);
    return { ok: false, error: "Could not save the stock change. Try again." };
  }
  if (!result.ok) return result;

  revalidatePath("/admin/inventory");
  revalidatePath("/inventory");
  try {
    const email = await sendInventoryAlerts(result.alerts);
    if (email.attempted === 0) return { ok: true };
    if (email.sent > 0) return { ok: true, email: "sent" };
    return { ok: true, email: email.skipped ? "skipped" : "failed" };
  } catch (error) {
    console.error("Failed to send inventory alert:", error);
    return { ok: true, email: "failed" };
  }
}

export async function updateSupplyInventory(formData: FormData) {
  return saveSupplyInventory(formData, "SET");
}

export async function adjustSupplyInventory(formData: FormData) {
  return saveSupplyInventory(formData, "RESTOCK");
}
