import type { UserRole } from "@prisma/client";

type OrderCreator = { id: string; role: UserRole };
type ExistingTableOrder = {
  waiterId: string | null;
} | null;

export class TableOrderOwnershipError extends Error {}

export function canWaiterUseTable(
  waiterId: string,
  openOrders: Array<{ waiterId: string | null }>,
) {
  return openOrders.every(
    (order) => !order.waiterId || order.waiterId === waiterId,
  );
}

export function resolveTableOrderAttribution(
  creator: OrderCreator,
  existingOrder: ExistingTableOrder,
) {
  if (
    creator.role === "WAITER" &&
    existingOrder?.waiterId &&
    existingOrder.waiterId !== creator.id
  ) {
    throw new TableOrderOwnershipError(
      "This table is assigned to another waiter.",
    );
  }

  return {
    cashierId: creator.id,
    waiterId:
      creator.role === "WAITER"
        ? creator.id
        : (existingOrder?.waiterId ?? null),
  };
}
