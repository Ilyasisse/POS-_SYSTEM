"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { closeSettledTableChecks } from "@/lib/cashier/table-checks";
import {
  isPosPaymentMethod,
  remainingPaymentAmount,
} from "@/lib/payments/payment-methods";

function toDecimal(value: number) {
  return new Prisma.Decimal(value);
}

function refreshCashierTableViews() {
  revalidatePath("/cashier");
  revalidatePath("/cashier/order");
  revalidatePath("/manager");
  revalidatePath("/admin/reports");
}

export async function payOpenTableOrdersFromCashier(formData: FormData) {
  const currentUser = await requirePermission(PERMISSIONS.PAYMENT_TAKE);

  const tableId = String(formData.get("tableId") ?? "").trim();
  const paymentMethod = String(formData.get("paymentMethod") ?? "").trim();

  if (!tableId || !isPosPaymentMethod(paymentMethod)) {
    redirect("/cashier?paymentStatus=invalid_payment");
  }

  let paymentStatus = "payment_saved";

  try {
    const paidOrderCount = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT "id" FROM "Table" WHERE "id" = ${tableId} FOR UPDATE`,
      );

      const orders = await tx.order.findMany({
        where: {
          tableId,
          status: "OPEN",
          type: "DINE_IN",
        },
        select: {
          id: true,
          total: true,
          tableCheckId: true,
          payments: { select: { amountPaid: true } },
        },
      });

      if (orders.length === 0) return 0;

      const closedAt = new Date();
      const settlements = orders
        .map((order) => ({
          ...order,
          remaining: remainingPaymentAmount(
            Number(order.total),
            order.payments.map((payment) => Number(payment.amountPaid)),
          ),
        }))
        .filter((order) => order.remaining > 0);
      if (settlements.length > 0) {
        await tx.payment.createMany({
          data: settlements.map((order) => ({
            orderId: order.id,
            cashierId: currentUser.id,
            cashierName: currentUser.fullName,
            method: paymentMethod,
            amountPaid: toDecimal(order.remaining),
          })),
        });
      }

      await tx.order.updateMany({
        where: {
          id: {
            in: orders.map((order) => order.id),
          },
        },
        data: {
          status: "PAID",
          closedAt,
        },
      });

      await closeSettledTableChecks(
        tx,
        orders.map((order) => order.tableCheckId),
        closedAt,
      );

      await tx.paymentRequest.updateMany({
        where: {
          tableId,
          status: { in: ["PENDING", "PARTIALLY_MATCHED"] },
        },
        data: { status: "CANCELLED" },
      });
      await tx.paymentDeferral.updateMany({
        where: { tableId, resolvedAt: null },
        data: { resolvedAt: closedAt },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: currentUser.id,
          action: "TABLE_PAYMENT_RECORDED",
          entityType: "Table",
          entityId: tableId,
          newValue: {
            method: paymentMethod,
            orderIds: orders.map((order) => order.id),
            amount: settlements.reduce((sum, order) => sum + order.remaining, 0),
          },
        },
      });

      return orders.length;
    });

    if (paidOrderCount === 0) {
      paymentStatus = "order_not_open";
    } else {
      refreshCashierTableViews();
    }
  } catch (error) {
    console.error("Failed to pay open table orders:", error);
    paymentStatus = "payment_failed";
  }

  redirect(`/cashier?paymentStatus=${paymentStatus}`);
}
