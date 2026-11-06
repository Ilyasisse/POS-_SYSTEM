import "server-only";

import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { canViewOrderReceipt } from "./receipt-access";
import { buildReceiptData } from "./build-receipt-data";

export async function getOrderReceipt(id: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/staff-login");

  const [order, settings] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      include: {
        table: { select: { name: true } },
        tableCheck: { select: { checkNumber: true } },
        customer: { select: { fullName: true } },
        waiter: { select: { fullName: true } },
        cashier: { select: { fullName: true } },
        orderItems: {
          orderBy: { createdAt: "asc" },
          include: { modifiers: { orderBy: { modifierName: "asc" } } },
        },
        payments: {
          orderBy: { createdAt: "asc" },
          select: { method: true, reference: true, amountPaid: true },
        },
        salesAdjustments: {
          orderBy: { createdAt: "asc" },
          select: { type: true, amount: true },
        },
      },
    }),
    prisma.cafeSetting.findUnique({
      where: { id: "default" },
      select: {
        businessName: true,
        currencyCode: true,
        timezone: true,
      },
    }),
  ]);

  if (!order) notFound();
  if (!canViewOrderReceipt(currentUser, order)) {
    redirect("/staff-login?error=unauthorized");
  }
  return buildReceiptData(order, settings);
}
