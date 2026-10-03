import type { Prisma } from "@prisma/client";

type PaymentTransaction = Pick<
  Prisma.TransactionClient,
  "$queryRawUnsafe" | "order"
>;

export function remainingOrderBalanceCents(order: {
  total: unknown;
  payments: readonly { amountPaid: unknown }[];
}) {
  const paidCents = order.payments.reduce(
    (sum, payment) => sum + Math.round(Number(payment.amountPaid) * 100),
    0,
  );
  return Math.max(0, Math.round(Number(order.total) * 100) - paidCents);
}

// Every settlement path takes the table lock before order/request/receipt locks.
// Different payer rows must serialize against the same table balance.
export async function lockTableForSettlement(
  tx: PaymentTransaction,
  tableId: string,
) {
  await tx.$queryRawUnsafe(
    'SELECT "id" FROM "Table" WHERE "id" = $1 FOR UPDATE',
    tableId,
  );
  await tx.$queryRawUnsafe(
    'SELECT "id" FROM "Order" WHERE "tableId" = $1 AND "status" = \'OPEN\' ORDER BY "id" FOR UPDATE',
    tableId,
  );
}

export async function lockOrderForSettlement(
  tx: PaymentTransaction,
  orderId: string,
) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { tableId: true },
  });
  if (order?.tableId) await lockTableForSettlement(tx, order.tableId);
  await tx.$queryRawUnsafe(
    'SELECT "id" FROM "Order" WHERE "id" = $1 FOR UPDATE',
    orderId,
  );
}

export class OrderSettlementError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404 | 409,
  ) {
    super(message);
    this.name = "OrderSettlementError";
  }
}
