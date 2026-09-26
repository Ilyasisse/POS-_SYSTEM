import { NextResponse } from "next/server";
import { PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import {
  closeSettledTableChecks,
  resolveTableCheckIdentity,
} from "@/lib/cashier/table-checks";
import { getPostHogClient } from "@/lib/posthog-server";
import {
  lockCashierTable,
  TableOwnershipError,
} from "@/lib/cashier/table-ownership";

type PayOrderBody = {
  orderId?: string;
  paymentMethod?: PaymentMethod | string;
};

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

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const currentUser = await prisma.staff.findUnique({
      where: { id: authUser.id },
      select: {
        id: true,
        fullName: true,
        role: true,
        isActive: true,
      },
    });

    if (!currentUser || !currentUser.isActive) {
      return NextResponse.json(
        { error: "Staff account not found." },
        { status: 403 },
      );
    }

    if (!hasPermission(currentUser, PERMISSIONS.PAYMENT_TAKE)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const body = (await request.json()) as PayOrderBody;
    const orderId = String(body.orderId ?? "").trim();
    const paymentMethod = String(body.paymentMethod ?? "").trim();

    if (!orderId) {
      return NextResponse.json(
        { error: "Order is required." },
        { status: 400 },
      );
    }

    if (!isPaymentMethod(paymentMethod)) {
      return NextResponse.json(
        { error: "Payment method is invalid." },
        { status: 400 },
      );
    }

    const order = await prisma.order.findUnique({
      where: {
        id: orderId,
      },
      select: {
        id: true,
        tableId: true,
        orderNumber: true,
        tableCheckId: true,
        tableCheckRound: true,
        tableCheck: { select: { checkNumber: true } },
        status: true,
        total: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (order.status !== "OPEN") {
      return NextResponse.json(
        { error: "Only open orders can be paid." },
        { status: 400 },
      );
    }

    const closedAt = new Date();
    await prisma.$transaction(async (tx) => {
      if (order.tableId) {
        await lockCashierTable(tx, order.tableId, currentUser, true);
      }
      const currentOrder = await tx.order.findUnique({
        where: { id: order.id },
        select: { status: true },
      });
      if (currentOrder?.status !== "OPEN") {
        throw new TableOwnershipError("Only open orders can be paid.", 400);
      }
      await tx.payment.create({
        data: {
          orderId: order.id,
          cashierId: currentUser.id,
          cashierName: currentUser.fullName,
          method: paymentMethod,
          amountPaid: toDecimal(Number(order.total)),
        },
      });

      const paidOrder = await tx.order.updateMany({
        where: { id: order.id, status: "OPEN" },
        data: { status: "PAID", closedAt },
      });
      if (paidOrder.count !== 1) {
        throw new TableOwnershipError("Only open orders can be paid.", 400);
      }

      await closeSettledTableChecks(tx, [order.tableCheckId], closedAt);
    });

    const identity = resolveTableCheckIdentity(order);

    const posthog = getPostHogClient();
    if (posthog) {
      posthog.capture({
        distinctId: currentUser.id,
        event: "order_paid",
        properties: {
          order_id: order.id,
          payment_method: paymentMethod,
          total: Number(order.total),
          cashier_role: currentUser.role,
        },
      });
      await posthog.flush();
    }

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        ...identity,
        total: Number(order.total),
        status: "PAID",
      },
    });
  } catch (error) {
    console.error("Pay order error:", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to pay order.",
      },
      { status: error instanceof TableOwnershipError ? error.status : 500 },
    );
  }
}
