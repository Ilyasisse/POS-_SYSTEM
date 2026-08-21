import "server-only";

import {
  Prisma,
  type StockEventType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  calculateCountVariance,
  calculateRecipeStandardCost,
  convertPurchaseQuantity,
  decimalCost,
  positiveDecimalQuantity,
  selectEffectiveRecipe,
} from "@/lib/inventory/inventory-domain";

type StockTarget =
  | { productId: string; supplyId?: never }
  | { productId?: never; supplyId: string };

type StockMutation = StockTarget & {
  type: StockEventType;
  quantityDelta: Prisma.Decimal | string | number;
  reason: string;
  actorUserId?: string | null;
  approvedByUserId?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  occurredAt?: Date;
};

function signedQuantity(value: Prisma.Decimal | string | number) {
  const quantity = new Prisma.Decimal(value).toDecimalPlaces(6, Prisma.Decimal.ROUND_HALF_UP);
  if (!quantity.isFinite() || quantity.isZero()) {
    throw new Error("Stock-event quantity must be a non-zero decimal.");
  }
  return quantity;
}

export async function appendStockEvent(
  tx: Prisma.TransactionClient,
  input: StockMutation,
) {
  const delta = signedQuantity(input.quantityDelta);
  const isProduct = Boolean(input.productId);
  const updateData = { stockQty: { increment: delta } };
  const item = isProduct
    ? await (async () => {
        const updated = await tx.product.updateMany({
          where: {
            id: input.productId!,
            ...(delta.isNegative() ? { stockQty: { gte: delta.abs() } } : {}),
          },
          data: updateData,
        });
        if (updated.count !== 1) throw new Error(delta.isNegative() ? "Insufficient inventory for this stock event." : "Inventory target not found.");
        const product = await tx.product.findUniqueOrThrow({
          where: { id: input.productId! },
          select: { stockQty: true, canonicalUnit: true, cost: true, quantityCoverage: true },
        });
        return { ...product, standardCost: product.cost };
      })()
    : await (async () => {
        const updated = await tx.inventorySupply.updateMany({
          where: {
            id: input.supplyId!,
            ...(delta.isNegative() ? { stockQty: { gte: delta.abs() } } : {}),
          },
          data: updateData,
        });
        if (updated.count !== 1) throw new Error(delta.isNegative() ? "Insufficient inventory for this stock event." : "Inventory target not found.");
        const supply = await tx.inventorySupply.findUniqueOrThrow({
          where: { id: input.supplyId! },
          select: { stockQty: true, canonicalUnit: true, standardUnitCost: true, quantityCoverage: true },
        });
        return { ...supply, standardCost: supply.standardUnitCost };
      })();
  const canonicalUnit = item.canonicalUnit;
  if (!canonicalUnit) throw new Error("Inventory unit mapping is incomplete.");
  const after = new Prisma.Decimal(item.stockQty);
  const before = after.sub(delta);
  const standardCost = item.standardCost;

  return tx.stockEvent.create({
    data: {
      productId: input.productId ?? null,
      supplyId: input.supplyId ?? null,
      type: input.type,
      quantityDelta: delta,
      quantityBefore: before,
      quantityAfter: after,
      canonicalUnit,
      standardUnitCostSnapshot: standardCost,
      dataCoverage:
        item.quantityCoverage === "COMPLETE" && standardCost != null
          ? "COMPLETE"
          : standardCost == null
            ? "MISSING_COST"
            : item.quantityCoverage,
      reason: input.reason.trim() || input.type,
      actorUserId: input.actorUserId ?? null,
      approvedByUserId: input.approvedByUserId ?? null,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      occurredAt: input.occurredAt ?? new Date(),
    },
  });
}

function appendStockEventsInOrder(
  tx: Prisma.TransactionClient,
  mutations: readonly StockMutation[],
) {
  return mutations.reduce<Promise<Awaited<ReturnType<typeof appendStockEvent>>[]>>(
    (pendingEvents, mutation) =>
      pendingEvents.then((events) =>
        appendStockEvent(tx, mutation).then((event) => {
          events.push(event);
          return events;
        }),
      ),
    Promise.resolve([]),
  );
}

export type SaleInventoryLine = { productId: string; qty: number };

export async function deductSaleInventory(
  tx: Prisma.TransactionClient,
  lines: readonly SaleInventoryLine[],
  sourceOrderId: string | null,
  actorUserId?: string | null,
) {
  const quantityByProduct = new Map<string, Prisma.Decimal>();
  for (const line of lines) {
    const qty = positiveDecimalQuantity(line.qty, "Sold quantity");
    quantityByProduct.set(
      line.productId,
      (quantityByProduct.get(line.productId) ?? new Prisma.Decimal(0)).add(qty),
    );
  }
  const now = new Date();
  const products = await tx.product.findMany({
    where: { id: { in: [...quantityByProduct.keys()] } },
    include: {
      recipeVersions: {
        where: { isActive: true, effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] },
        include: { ingredients: true },
        orderBy: { effectiveFrom: "desc" },
      },
    },
  });
  const mutations = products.flatMap<StockMutation>((product) => {
    const sold = quantityByProduct.get(product.id)!;
    const recipe = selectEffectiveRecipe(product.recipeVersions, now);
    if (recipe) {
      return recipe.ingredients.map((ingredient) => {
        const usage = new Prisma.Decimal(ingredient.quantity).mul(sold).div(recipe.yieldQuantity);
        return {
          supplyId: ingredient.supplyId,
          type: "RECIPE_USAGE",
          quantityDelta: usage.negated(),
          reason: `Recipe usage: ${product.name}`,
          actorUserId,
          sourceType: "Order",
          sourceId: sourceOrderId,
        };
      });
    }
    return product.trackStock
      ? [{
          productId: product.id,
          type: "SALE_USAGE",
          quantityDelta: sold.negated(),
          reason: `Finished-item sale: ${product.name}`,
          actorUserId,
          sourceType: "Order",
          sourceId: sourceOrderId,
        }]
      : [];
  });
  return appendStockEventsInOrder(tx, mutations);
}

export async function recordSupplierInvoiceReceipts(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  actorUserId: string,
) {
  const items = await tx.supplierInvoiceItem.findMany({
    where: { invoiceId },
    include: {
      supplierCatalogItem: {
        include: {
          product: true,
          inventorySupply: { include: { purchaseUnitConversions: true } },
        },
      },
    },
  });
  const receiptPlan = items.reduce<{ mutations: StockMutation[]; incomplete: number }>((plan, item) => {
    const catalog = item.supplierCatalogItem;
    if (!catalog) {
      plan.incomplete += 1;
      return plan;
    }
    if (catalog.inventorySupply) {
      const conversion = catalog.inventorySupply.purchaseUnitConversions.find(
        (candidate) => candidate.isActive && candidate.purchaseUnit.trim().toLowerCase() === item.itemUnit.trim().toLowerCase(),
      );
      if (
        !conversion ||
        !catalog.inventorySupply.canonicalUnit ||
        catalog.inventorySupply.quantityCoverage !== "COMPLETE"
      ) {
        plan.incomplete += 1;
        return plan;
      }
      plan.mutations.push({
        supplyId: catalog.inventorySupply.id,
        type: "RECEIPT",
        quantityDelta: convertPurchaseQuantity(item.quantity, conversion.canonicalQuantity),
        reason: `Supplier invoice receipt: ${item.itemName}`,
        actorUserId,
        sourceType: "SupplierInvoice",
        sourceId: invoiceId,
      });
      return plan;
    }
    if (
      catalog.product?.trackStock &&
      catalog.product.quantityCoverage === "COMPLETE" &&
      catalog.product.canonicalUnit === "PIECE" &&
      ["piece", "pieces", "pc", "pcs", "unit", "units", "each"].includes(item.itemUnit.trim().toLowerCase())
    ) {
      plan.mutations.push({
        productId: catalog.product.id,
        type: "RECEIPT",
        quantityDelta: item.quantity,
        reason: `Supplier invoice receipt: ${item.itemName}`,
        actorUserId,
        sourceType: "SupplierInvoice",
        sourceId: invoiceId,
      });
    } else {
      plan.incomplete += 1;
    }
    return plan;
  }, { mutations: [], incomplete: 0 });
  const events = await appendStockEventsInOrder(tx, receiptPlan.mutations);
  return { recorded: events.length, incomplete: receiptPlan.incomplete };
}

export async function updateProductStandardCost(input: {
  productId: string;
  cost: Prisma.Decimal | string | number | null;
  actorUserId: string;
  reason: string;
}) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.product.findUniqueOrThrow({ where: { id: input.productId }, select: { cost: true } });
    const cost = input.cost == null ? null : decimalCost(input.cost, "Product standard cost");
    const product = await tx.product.update({
      where: { id: input.productId },
      data: { cost, standardCostUpdatedAt: new Date(), standardCostUpdatedByUserId: input.actorUserId },
    });
    await tx.auditLog.create({ data: {
      actorUserId: input.actorUserId,
      action: "inventory.product_standard_cost.changed",
      entityType: "Product",
      entityId: input.productId,
      reason: input.reason,
      previousValue: { cost: current.cost?.toString() ?? null },
      newValue: { cost: cost?.toString() ?? null },
    } });
    return product;
  });
}

export async function updateSupplyStandardCost(input: {
  supplyId: string;
  cost: Prisma.Decimal | string | number | null;
  actorUserId: string;
  reason: string;
}) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.inventorySupply.findUniqueOrThrow({ where: { id: input.supplyId }, select: { standardUnitCost: true } });
    const cost = input.cost == null ? null : decimalCost(input.cost, "Supply standard cost");
    const supply = await tx.inventorySupply.update({
      where: { id: input.supplyId },
      data: { standardUnitCost: cost, standardCostUpdatedAt: new Date(), standardCostUpdatedByUserId: input.actorUserId },
    });
    await tx.auditLog.create({ data: {
      actorUserId: input.actorUserId,
      action: "inventory.supply_standard_cost.changed",
      entityType: "InventorySupply",
      entityId: input.supplyId,
      reason: input.reason,
      previousValue: { cost: current.standardUnitCost?.toString() ?? null },
      newValue: { cost: cost?.toString() ?? null },
    } });
    return supply;
  });
}

export async function createRecipeVersion(input: {
  productId: string;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  yieldQuantity: Prisma.Decimal | string | number;
  createdByUserId: string;
  ingredients: readonly { supplyId: string; quantity: Prisma.Decimal | string | number }[];
}) {
  return prisma.$transaction(async (tx) => {
    const supplies = await tx.inventorySupply.findMany({
      where: { id: { in: input.ingredients.map((item) => item.supplyId) } },
      select: { id: true, standardUnitCost: true },
    });
    if (supplies.length !== input.ingredients.length) throw new Error("Every recipe ingredient must reference a supply.");
    const costs = new Map(supplies.map((supply) => [supply.id, supply.standardUnitCost]));
    const cost = calculateRecipeStandardCost(
      input.yieldQuantity,
      input.ingredients.map((ingredient) => ({ quantity: ingredient.quantity, standardUnitCost: costs.get(ingredient.supplyId) ?? null })),
    );
    const latest = await tx.recipeVersion.aggregate({ where: { productId: input.productId }, _max: { version: true } });
    return tx.recipeVersion.create({
      data: {
        productId: input.productId,
        version: (latest._max.version ?? 0) + 1,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo ?? null,
        yieldQuantity: positiveDecimalQuantity(input.yieldQuantity, "Recipe yield"),
        standardCost: cost.unitCost,
        costCoverage: cost.coverage,
        createdByUserId: input.createdByUserId,
        ingredients: {
          create: input.ingredients.map((ingredient) => ({
            supplyId: ingredient.supplyId,
            quantity: positiveDecimalQuantity(ingredient.quantity, "Ingredient quantity"),
            standardUnitCostSnapshot: costs.get(ingredient.supplyId) ?? null,
          })),
        },
      },
      include: { ingredients: true },
    });
  });
}

export async function submitInventoryCount(sessionId: string, submittedByUserId: string) {
  const result = await prisma.inventoryCountSession.updateMany({
    where: { id: sessionId, status: "DRAFT", lines: { some: {} } },
    data: { status: "SUBMITTED", submittedByUserId, submittedAt: new Date() },
  });
  if (result.count !== 1) throw new Error("Only a non-empty draft count can be submitted.");
}

export async function approveInventoryCount(sessionId: string, approvedByUserId: string) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.inventoryCountSession.findUnique({ where: { id: sessionId }, include: { lines: true } });
    if (!session || session.status !== "SUBMITTED") throw new Error("Only a submitted count can be approved.");
    await session.lines.reduce<Promise<void>>(
      (pendingLine, line) => pendingLine.then(async () => {
        const variance = calculateCountVariance(line.expectedQuantity, line.physicalQuantity);
        const event = variance.isZero()
          ? null
          : await appendStockEvent(tx, {
              ...(line.productId ? { productId: line.productId } : { supplyId: line.supplyId! }),
              type: "COUNT_VARIANCE",
              quantityDelta: variance,
              reason: session.reason || "Approved physical count variance",
              approvedByUserId,
              sourceType: "InventoryCountSession",
              sourceId: session.id,
            });
        await tx.inventoryCountLine.update({ where: { id: line.id }, data: { varianceQuantity: variance, stockEventId: event?.id ?? null } });
      }),
      Promise.resolve(),
    );
    return tx.inventoryCountSession.update({
      where: { id: session.id },
      data: { status: "APPROVED", approvedByUserId, approvedAt: new Date() },
      include: { lines: true },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
