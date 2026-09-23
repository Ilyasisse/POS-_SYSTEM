import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getInventoryAlertStatus,
  type InventoryAlert,
} from "@/lib/inventory/inventory";
import { appendStockEvent } from "@/lib/inventory/stock-ledger";
import { canonicalUnitLabel } from "@/lib/inventory/inventory-domain";
import {
  wasteStatusAlert,
  wasteInputSchema,
} from "@/lib/inventory/waste-input";

type WasteInput = ReturnType<typeof wasteInputSchema.parse>;

export async function recordSupplyWaste(
  input: WasteInput,
  actorUserId: string,
): Promise<InventoryAlert[]> {
  const quantity = new Prisma.Decimal(input.quantity);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "InventorySupply" WHERE "id" = ${input.supplyId} FOR UPDATE`;
    const supply = await tx.inventorySupply.findUnique({
      where: { id: input.supplyId },
      select: {
        id: true,
        name: true,
        isActive: true,
        stockQty: true,
        lowStockThreshold: true,
        inventoryAlertStatus: true,
        canonicalUnit: true,
      },
    });
    if (!supply?.isActive)
      throw new Error("This supply is no longer available.");
    if (!supply.canonicalUnit)
      throw new Error(
        "Set a canonical unit for this supply before recording waste.",
      );
    if (supply.stockQty.lt(quantity))
      throw new Error("Quantity exceeds the available stock.");

    const event = await appendStockEvent(tx, {
      supplyId: supply.id,
      type: input.type,
      quantityDelta: quantity.negated(),
      reason: input.reason,
      actorUserId,
      sourceType: "InventoryWaste",
      sourceId: supply.id,
    });
    const nextStatus = getInventoryAlertStatus(
      Number(event.quantityAfter),
      Number(supply.lowStockThreshold),
    );
    await tx.inventorySupply.update({
      where: { id: supply.id },
      data: { inventoryAlertStatus: nextStatus },
    });
    await tx.inventoryMovement.create({
      data: {
        supplyId: supply.id,
        itemName: `${supply.name} (${canonicalUnitLabel(event.canonicalUnit)})`,
        itemType: "Supply",
        delta: event.quantityDelta,
        quantityBefore: event.quantityBefore,
        quantityAfter: event.quantityAfter,
        canonicalUnit: event.canonicalUnit,
        dataCoverage: event.dataCoverage,
        standardUnitCostSnapshot: event.standardUnitCostSnapshot,
        reason: input.type,
        note: input.reason,
      },
    });
    return wasteStatusAlert(supply.inventoryAlertStatus, nextStatus)
      ? [
          {
            itemName: supply.name,
            itemType: "Supply",
            status: nextStatus,
            stockQty: Number(event.quantityAfter),
            lowStockThreshold: Number(supply.lowStockThreshold),
          },
        ]
      : [];
  });
}
