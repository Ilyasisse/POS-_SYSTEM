"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { closeSettledTableChecks } from "@/lib/cashier/table-checks";
import { transferOpenTableService } from "@/lib/cashier/table-transfer";

function isPaymentMethod(value: string): value is PaymentMethod {
  return (
    value === "MYCASH" ||
    value === "GOLIS" ||
    value === "Dahabshiil" ||
    value === "OTHER"
  );
}

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

  if (!tableId || !isPaymentMethod(paymentMethod)) {
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
        },
      });

      if (orders.length === 0) return 0;

      const closedAt = new Date();
      await tx.payment.createMany({
        data: orders.map((order) => ({
          orderId: order.id,
          cashierId: currentUser.id,
          cashierName: currentUser.fullName,
          method: paymentMethod,
          amountPaid: toDecimal(Number(order.total)),
        })),
      });

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

export async function transferOpenTableServiceFromCashier(formData: FormData) {
  await requirePermission(PERMISSIONS.ORDER_MANAGE);
  const sourceTableId = String(formData.get("sourceTableId") ?? "").trim();
  const targetTableId = String(formData.get("targetTableId") ?? "").trim();
  let transferStatus = "table_moved";

  try {
    await transferOpenTableService({ sourceTableId, targetTableId });
    refreshCashierTableViews();
  } catch (error) {
    console.error("Failed to transfer open table service:", error);
    transferStatus = "table_move_failed";
  }

  redirect(`/cashier?transferStatus=${transferStatus}`);
}
