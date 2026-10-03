import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  processMycashGolisWebhook,
  readPaymentWebhookConfig,
  verifyPaymentWebhookSignature,
  type MycashGolisWebhookEvent,
  type PaymentWebhookCashier,
  type PaymentWebhookOrder,
  type PaymentWebhookStore,
} from "@/lib/payments/mycash-golis-webhook";
import { closeSettledTableChecks } from "@/lib/cashier/table-checks";
import {
  lockOrderForSettlement,
  OrderSettlementError,
  remainingOrderBalanceCents,
} from "@/lib/payments/order-settlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toDecimal(value: number) {
  return new Prisma.Decimal(value);
}

function isPaymentReferenceDuplicateError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function findTableCheckForWebhook(tableCheckId: string) {
  const check = await prisma.tableCheck.findUnique({
    where: { id: tableCheckId },
    select: {
      id: true,
      checkNumber: true,
      orders: {
        select: {
          id: true,
          status: true,
          total: true,
          payments: { select: { amountPaid: true } },
        },
        orderBy: [{ tableCheckRound: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!check || check.orders.length === 0) return null;

  const openRounds = check.orders.filter((order) => order.status === "OPEN");
  const payableRounds = openRounds.length > 0 ? openRounds : check.orders;
  const status =
    openRounds.length > 0
      ? "OPEN"
      : check.orders.every((order) => order.status === "PAID")
        ? "PAID"
        : "CANCELLED";

  return {
    id: payableRounds[0]?.id ?? check.orders[0]!.id,
    orderNumber: check.checkNumber,
    status,
    total: payableRounds.reduce((sum, order) => sum + Number(order.total), 0),
    remainingAmount:
      payableRounds.reduce(
        (sum, order) => sum + remainingOrderBalanceCents(order),
        0,
      ) / 100,
    tableCheckId: check.id,
    rounds: payableRounds.map((order) => ({
      id: order.id,
      total: order.total,
    })),
  } satisfies PaymentWebhookOrder;
}

function buildPaymentWebhookStore(): PaymentWebhookStore {
  return {
    async getCashier(cashierId: string) {
      return prisma.staff.findUnique({
        where: { id: cashierId },
        select: {
          id: true,
          fullName: true,
          isActive: true,
        },
      });
    },
    async findPaymentByReference(provider, reference) {
      return prisma.payment.findFirst({
        where: {
          method: provider,
          reference,
        },
        select: {
          id: true,
          orderId: true,
          reference: true,
        },
      });
    },
    async findOrder(event: MycashGolisWebhookEvent) {
      if (event.orderId) {
        const order = await prisma.order.findUnique({
          where: { id: event.orderId },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            total: true,
            tableCheckId: true,
            payments: { select: { amountPaid: true } },
          },
        });

        if (order?.tableCheckId) {
          return findTableCheckForWebhook(order.tableCheckId);
        }

        return order
          ? {
              ...order,
              remainingAmount: remainingOrderBalanceCents(order) / 100,
            }
          : null;
      }

      const tableCheck = await prisma.tableCheck.findUnique({
        where: { checkNumber: event.orderNumber ?? 0 },
        select: { id: true },
      });

      if (tableCheck) {
        return findTableCheckForWebhook(tableCheck.id);
      }

      const order = await prisma.order.findUnique({
        where: { orderNumber: event.orderNumber ?? 0 },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          payments: { select: { amountPaid: true } },
        },
      });
      return order
        ? { ...order, remainingAmount: remainingOrderBalanceCents(order) / 100 }
        : null;
    },
    async markOrderPaid(input: {
      event: MycashGolisWebhookEvent;
      order: PaymentWebhookOrder;
      cashier: PaymentWebhookCashier;
      paidAt: Date;
    }) {
      await prisma.$transaction(
        async (tx) => {
          await lockOrderForSettlement(tx, input.order.id);
          const existing = await tx.payment.findFirst({
            where: {
              method: input.event.provider,
              reference: input.event.reference,
            },
          });
          if (existing) return;
          const rounds = await tx.order.findMany({
            where: input.order.tableCheckId
              ? { tableCheckId: input.order.tableCheckId, status: "OPEN" }
              : { id: input.order.id, status: "OPEN" },
            include: { payments: { select: { amountPaid: true } } },
            orderBy: [{ tableCheckRound: "asc" }, { createdAt: "asc" }],
          });
          if (!rounds.length) {
            throw new OrderSettlementError(
              "Order is not open for payment.",
              409,
            );
          }
          const remainingCents = rounds.reduce(
            (sum, round) => sum + remainingOrderBalanceCents(round),
            0,
          );
          if (remainingCents !== Math.round(input.event.amount * 100)) {
            throw new OrderSettlementError(
              "Payment amount does not match the remaining order balance.",
              409,
            );
          }

          await tx.payment.createMany({
            data: rounds
              .filter((round) => remainingOrderBalanceCents(round) > 0)
              .map((round, index) => ({
                orderId: round.id,
                cashierId: input.cashier.id,
                cashierName: input.cashier.fullName,
                method: input.event.provider,
                amountPaid: toDecimal(remainingOrderBalanceCents(round) / 100),
                reference: index === 0 ? input.event.reference : null,
                createdAt: input.paidAt,
              })),
          });

          await tx.order.updateMany({
            where: { id: { in: rounds.map((round) => round.id) } },
            data: {
              status: "PAID",
              closedAt: input.paidAt,
            },
          });

          await closeSettledTableChecks(
            tx,
            [input.order.tableCheckId],
            input.paidAt,
          );
        },
        { timeout: 15000, maxWait: 5000 },
      );
    },
  };
}

export async function POST(request: Request) {
  const config = readPaymentWebhookConfig(process.env);

  if (!config.ok) {
    return NextResponse.json({ error: config.error }, { status: 500 });
  }

  const rawBody = await request.text();

  if (
    !verifyPaymentWebhookSignature(
      rawBody,
      request.headers.get("x-webhook-signature"),
      config.secret,
    )
  ) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  try {
    const result = await processMycashGolisWebhook(payload, {
      cashierId: config.cashierId,
      store: buildPaymentWebhookStore(),
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    if (error instanceof OrderSettlementError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    if (isPaymentReferenceDuplicateError(error)) {
      return NextResponse.json(
        {
          ok: true,
          duplicate: true,
        },
        { status: 200 },
      );
    }

    console.error("MYCASH/GOLIS payment webhook error:", error);

    return NextResponse.json(
      { error: "Payment webhook failed." },
      { status: 500 },
    );
  }
}
