import "server-only";

import {
  Prisma,
  SalesAdjustmentType,
} from "@prisma/client";
import { z } from "zod";
import {
  adjustmentReducesAmountDue,
  isAdjustmentAllowedForStatus,
} from "@/lib/sales/adjustment-rules";
export {
  requiredAdjustmentPermission,
  snapshotProductCost,
} from "@/lib/sales/adjustment-rules";

type TransactionClient = Prisma.TransactionClient;

const adjustmentSchema = z.object({
  orderId: z.string().trim().min(1),
  orderItemId: z.string().trim().min(1).nullable().optional(),
  type: z.enum(SalesAdjustmentType),
  amount: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
  quantity: z.string().regex(/^\d+(?:\.\d{1,3})?$/).nullable().optional(),
  reason: z.string().trim().min(3).max(500),
  actorUserId: z.string().trim().min(1),
  approvedByUserId: z.string().trim().min(1),
});

export type CreateSalesAdjustmentInput = z.input<typeof adjustmentSchema>;

export class SalesAdjustmentError extends Error {
  constructor(message: string, public readonly status: 400 | 404 | 409) {
    super(message);
    this.name = "SalesAdjustmentError";
  }
}

export async function createSalesAdjustment(
  tx: TransactionClient,
  rawInput: CreateSalesAdjustmentInput,
) {
  const parsed = adjustmentSchema.safeParse(rawInput);
  if (!parsed.success) throw new SalesAdjustmentError("Invalid sales adjustment.", 400);
  const input = parsed.data;
  const amount = new Prisma.Decimal(input.amount);
  if (amount.lte(0)) throw new SalesAdjustmentError("Adjustment amount must be greater than zero.", 400);

  const order = await tx.order.findUnique({
    where: { id: input.orderId },
    select: {
      id: true,
      status: true,
      total: true,
      orderItems: { select: { id: true, lineTotal: true } },
      payments: { select: { amountPaid: true } },
      salesAdjustments: { select: { type: true, amount: true } },
    },
  });
  if (!order) throw new SalesAdjustmentError("Order not found.", 404);
  if (!isAdjustmentAllowedForStatus(input.type, order.status)) {
    throw new SalesAdjustmentError(
      input.type === "REFUND"
        ? "Only paid orders can be refunded."
        : "Only open orders can receive this adjustment.",
      409,
    );
  }

  const orderItem = input.orderItemId
    ? order.orderItems.find((item) => item.id === input.orderItemId)
    : null;
  if (input.orderItemId && !orderItem) {
    throw new SalesAdjustmentError("Order item does not belong to this order.", 400);
  }
  if (orderItem && amount.gt(orderItem.lineTotal)) {
    throw new SalesAdjustmentError("Adjustment exceeds the selected line total.", 400);
  }

  const previousSameType = order.salesAdjustments
    .filter((adjustment) => adjustment.type === input.type)
    .reduce<Prisma.Decimal>((sum, adjustment) => sum.plus(adjustment.amount), new Prisma.Decimal(0));
  if (input.type === "REFUND") {
    const paid = order.payments.reduce<Prisma.Decimal>((sum, payment) => sum.plus(payment.amountPaid), new Prisma.Decimal(0));
    if (previousSameType.plus(amount).gt(paid)) {
      throw new SalesAdjustmentError("Refund exceeds the amount paid.", 400);
    }
  } else if (input.type !== "VOID" && amount.gt(order.total)) {
    throw new SalesAdjustmentError("Adjustment exceeds the amount due.", 400);
  }

  const effectiveAmount = input.type === "VOID" ? order.total : amount;
  const adjustment = await tx.salesAdjustment.create({
    data: {
      orderId: order.id,
      orderItemId: input.orderItemId ?? null,
      type: input.type,
      amount: effectiveAmount,
      quantity: input.quantity ? new Prisma.Decimal(input.quantity) : null,
      reason: input.reason,
      actorUserId: input.actorUserId,
      approvedByUserId: input.approvedByUserId,
    },
  });

  if (input.type === "VOID") {
    await tx.order.update({ where: { id: order.id }, data: { status: "CANCELLED", closedAt: new Date() } });
  } else if (adjustmentReducesAmountDue(input.type)) {
    await tx.order.update({ where: { id: order.id }, data: { total: order.total.minus(effectiveAmount) } });
  }

  await tx.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: `sales.adjustment.${input.type.toLowerCase()}`,
      entityType: "SalesAdjustment",
      entityId: adjustment.id,
      reason: input.reason,
      newValue: {
        orderId: order.id,
        orderItemId: input.orderItemId ?? null,
        type: input.type,
        amount: effectiveAmount.toFixed(2),
        approvedByUserId: input.approvedByUserId,
      },
      relatedEntityType: "Order",
      relatedEntityId: order.id,
    },
  });
  return adjustment;
}
