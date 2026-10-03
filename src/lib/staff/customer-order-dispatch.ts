import type { Prisma } from "@prisma/client";
import { buildActiveWaiterShiftWhere } from "@/lib/waiter/waiter-shift-gate";

/** Called inside order finalization so assignment and notification are durable. */
export async function dispatchCustomerOrder(tx: Prisma.TransactionClient, input: {
  orderId: string; orderNumber: number; customerId: string; tableName: string | null;
}) {
  const now = new Date();
  const [waiter, cashier] = await Promise.all([tx.staff.findFirst({
    where: {
      role: "WAITER", isActive: true,
      shifts: { some: buildActiveWaiterShiftWhere(undefined, now) },
    },
    orderBy: { waiterOrders: { _count: "asc" } },
    select: { id: true },
  }), tx.staff.findFirst({
    where: {
      role: "CASHIER", isActive: true, availability: "AVAILABLE",
      lastSeenAt: { gte: new Date(now.getTime() - 90_000) },
    },
    orderBy: { orders: { _count: "asc" } }, select: { id: true },
  })]);
  await tx.order.update({
    where: { id: input.orderId }, data: { waiterId: waiter?.id ?? null, cashierId: cashier?.id ?? null },
  });
  const recipientId = waiter?.id ?? cashier?.id;
  await tx.auditLog.create({
    data: {
      actorCustomerId: input.customerId,
      action: recipientId ? "customer_order.assigned" : "customer_order.unassigned",
      entityType: recipientId ? "Staff" : "Order",
      entityId: recipientId ?? input.orderId,
      relatedEntityType: "Order", relatedEntityId: input.orderId,
      newValue: {
        orderNumber: input.orderNumber, waiterId: waiter?.id ?? null, cashierId: cashier?.id ?? null,
        destination: input.tableName ?? "To go",
      },
    },
  });
}
