"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";

const PAYMENT_METHODS = new Set<PaymentMethod>([
  "MYCASH",
  "GOLIS",
  "Dahabshiil",
  "OTHER",
]);

function isPaymentMethod(value: string): value is PaymentMethod {
  return PAYMENT_METHODS.has(value as PaymentMethod);
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
    const orders = await prisma.order.findMany({
      where: {
        tableId,
        status: "OPEN",
        type: "DINE_IN",
      },
      select: {
        id: true,
        total: true,
      },
    });

    if (orders.length === 0) {
      paymentStatus = "order_not_open";
    } else {
      await prisma.$transaction(async (tx) => {
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
            closedAt: new Date(),
          },
        });
      });

      refreshCashierTableViews();
    }
  } catch (error) {
    console.error("Failed to pay open table orders:", error);
    paymentStatus = "payment_failed";
  }

  redirect(`/cashier?paymentStatus=${paymentStatus}`);
}
