export const CASHIER_DELETED_ORDER_ITEM_COOKIE =
  "cashier_last_deleted_order_items";

export const CASHIER_DELETED_ORDER_ITEM_LIMIT = 10;

export type DeletedOrderItemSnapshot = {
  undoId: string;
  deletedAt: string;
  waiterId: string;
  waiterName: string | null;
  order: {
    id: string;
    orderNumber: number;
    type: string;
    status: string;
    tableId: string | null;
    cashierId: string | null;
    waiterId: string | null;
    notes: string | null;
    total: number;
    createdAt: string;
    closedAt: string | null;
  };
  item: {
    id: string;
    productId: string;
    productName: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
    createdAt: string;
    assignedUserId: string | null;
    station: string | null;
    modifiers: Array<{
      id: string;
      modifierId: string;
      modifierName: string;
      qty: number;
      price: number;
    }>;
  };
  payments: Array<{
    id: string;
    cashierId: string;
    cashierName: string;
    method: string;
    amountPaid: number;
    reference: string | null;
    createdAt: string;
  }>;
};

export function parseDeletedOrderItemSnapshots(
  rawValue: string | undefined,
): DeletedOrderItemSnapshot[] {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as
      | DeletedOrderItemSnapshot
      | DeletedOrderItemSnapshot[];

    if (Array.isArray(parsed)) {
      return parsed;
    }

    return parsed ? [parsed] : [];
  } catch {
    return [];
  }
}
