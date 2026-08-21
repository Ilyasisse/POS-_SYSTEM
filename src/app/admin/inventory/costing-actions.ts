"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import {
  calculateCountVariance,
  decimalQuantity,
  positiveDecimalQuantity,
} from "@/lib/inventory/inventory-domain";
import {
  approveInventoryCount,
  createRecipeVersion,
  submitInventoryCount,
  updateProductStandardCost,
  updateSupplyStandardCost,
} from "@/lib/inventory/stock-ledger";

const costInput = z.object({
  id: z.string().trim().min(1),
  cost: z.string().trim().nullable(),
  reason: z.string().trim().min(3).max(500),
});

export async function updateProductStandardCostAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.INVENTORY_COST_MANAGE);
  const input = costInput.parse({
    id: formData.get("productId"),
    cost: String(formData.get("cost") ?? "").trim() || null,
    reason: formData.get("reason"),
  });
  await updateProductStandardCost({ productId: input.id, cost: input.cost, actorUserId: user.id, reason: input.reason });
  revalidatePath("/admin/inventory");
}

export async function updateSupplyStandardCostAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.INVENTORY_COST_MANAGE);
  const input = costInput.parse({
    id: formData.get("supplyId"),
    cost: String(formData.get("cost") ?? "").trim() || null,
    reason: formData.get("reason"),
  });
  await updateSupplyStandardCost({ supplyId: input.id, cost: input.cost, actorUserId: user.id, reason: input.reason });
  revalidatePath("/admin/inventory");
}

export async function savePurchaseUnitConversionAction(formData: FormData) {
  await requirePermission(PERMISSIONS.INVENTORY_MANAGE);
  const supplyId = z.string().trim().min(1).parse(formData.get("supplyId"));
  const purchaseUnit = z.string().trim().min(1).max(80).parse(formData.get("purchaseUnit"));
  const canonicalQuantity = positiveDecimalQuantity(String(formData.get("canonicalQuantity") ?? ""), "Canonical quantity");
  await prisma.inventoryUnitConversion.upsert({
    where: { supplyId_purchaseUnit: { supplyId, purchaseUnit } },
    create: { supplyId, purchaseUnit, canonicalQuantity },
    update: { canonicalQuantity, isActive: true },
  });
  revalidatePath("/admin/inventory");
}

export async function mapLegacySupplyUnitAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.INVENTORY_COST_MANAGE);
  const supplyId = z.string().trim().min(1).parse(formData.get("supplyId"));
  const canonicalUnit = z.enum(["GRAM", "MILLILITRE", "PIECE"]).parse(formData.get("canonicalUnit"));
  const factor = positiveDecimalQuantity(String(formData.get("factor") ?? ""), "Mapping factor");
  const reason = z.string().trim().min(3).max(500).parse(formData.get("reason"));
  await prisma.$transaction(async (tx) => {
    const supply = await tx.inventorySupply.findUniqueOrThrow({ where: { id: supplyId } });
    if (supply.quantityCoverage === "COMPLETE") throw new Error("This supply already has a completed unit mapping.");
    await tx.inventorySupply.update({
      where: { id: supplyId },
      data: {
        stockQty: supply.stockQty.mul(factor),
        lowStockThreshold: supply.lowStockThreshold.mul(factor),
        canonicalUnit,
        quantityCoverage: "COMPLETE",
      },
    });
    await tx.auditLog.create({ data: {
      actorUserId: user.id,
      action: "inventory.legacy_unit.mapped",
      entityType: "InventorySupply",
      entityId: supplyId,
      reason,
      previousValue: { unit: supply.unit, stockQty: supply.stockQty.toString(), lowStockThreshold: supply.lowStockThreshold.toString(), coverage: supply.quantityCoverage },
      newValue: { canonicalUnit, factor: factor.toString(), coverage: "COMPLETE" },
    } });
  });
  revalidatePath("/admin/inventory");
}

const recipeInput = z.object({
  productId: z.string().trim().min(1),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().nullable(),
  yieldQuantity: z.string().trim().min(1),
  ingredients: z.array(z.object({ supplyId: z.string().trim().min(1), quantity: z.string().trim().min(1) })).min(1),
});

export async function createRecipeVersionAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.INVENTORY_COST_MANAGE);
  const parsed = recipeInput.parse({
    productId: formData.get("productId"),
    effectiveFrom: formData.get("effectiveFrom"),
    effectiveTo: String(formData.get("effectiveTo") ?? "").trim() ? formData.get("effectiveTo") : null,
    yieldQuantity: formData.get("yieldQuantity"),
    ingredients: JSON.parse(String(formData.get("ingredients") ?? "[]")),
  });
  await createRecipeVersion({ ...parsed, createdByUserId: user.id });
  revalidatePath("/admin/inventory");
}

const countLineInput = z.object({
  productId: z.string().trim().min(1).optional(),
  supplyId: z.string().trim().min(1).optional(),
  physicalQuantity: z.string().trim().min(1),
}).refine((line) => Boolean(line.productId) !== Boolean(line.supplyId), "Each count line must have exactly one inventory target.");

export async function createInventoryCountAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.INVENTORY_COUNT_MANAGE);
  const businessDate = z.coerce.date().parse(formData.get("businessDate"));
  const reason = z.string().trim().max(500).parse(String(formData.get("reason") ?? "")) || null;
  const lines = z.array(countLineInput).min(1).parse(JSON.parse(String(formData.get("lines") ?? "[]")));
  await prisma.$transaction(async (tx) => {
    const [products, supplies] = await Promise.all([
      tx.product.findMany({ where: { id: { in: lines.flatMap((line) => line.productId ? [line.productId] : []) } } }),
      tx.inventorySupply.findMany({ where: { id: { in: lines.flatMap((line) => line.supplyId ? [line.supplyId] : []) } } }),
    ]);
    const productMap = new Map(products.map((item) => [item.id, item]));
    const supplyMap = new Map(supplies.map((item) => [item.id, item]));
    await tx.inventoryCountSession.create({
      data: {
        businessDate,
        reason,
        createdByUserId: user.id,
        lines: { create: lines.map((line) => {
          const item = line.productId ? productMap.get(line.productId) : supplyMap.get(line.supplyId!);
          if (!item || !item.canonicalUnit) throw new Error("Count target is missing or has incomplete unit mapping.");
          const physical = decimalQuantity(line.physicalQuantity, "Physical quantity");
          const expected = item.stockQty;
          const cost = "cost" in item ? item.cost : item.standardUnitCost;
          return {
            productId: line.productId ?? null,
            supplyId: line.supplyId ?? null,
            canonicalUnit: item.canonicalUnit,
            expectedQuantity: expected,
            physicalQuantity: physical,
            varianceQuantity: calculateCountVariance(expected, physical),
            standardUnitCostSnapshot: cost,
            dataCoverage: item.quantityCoverage === "COMPLETE" && cost != null ? "COMPLETE" : cost == null ? "MISSING_COST" : item.quantityCoverage,
          };
        }) },
      },
    });
  });
  revalidatePath("/admin/inventory");
}

export async function submitInventoryCountAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.INVENTORY_COUNT_MANAGE);
  await submitInventoryCount(z.string().trim().min(1).parse(formData.get("sessionId")), user.id);
  revalidatePath("/admin/inventory");
}

export async function approveInventoryCountAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.INVENTORY_COUNT_APPROVE);
  await approveInventoryCount(z.string().trim().min(1).parse(formData.get("sessionId")), user.id);
  revalidatePath("/admin/inventory");
}
