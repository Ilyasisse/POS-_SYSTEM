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
      return prisma.user.findUnique({
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
          },
        });

        if (order?.tableCheckId) {
          return findTableCheckForWebhook(order.tableCheckId);
        }

        return order;
      }

      const tableCheck = await prisma.tableCheck.findUnique({
        where: { checkNumber: event.orderNumber ?? 0 },
        select: { id: true },
      });

      if (tableCheck) {
        return findTableCheckForWebhook(tableCheck.id);
      }

      return prisma.order.findUnique({
        where: { orderNumber: event.orderNumber ?? 0 },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
        },
      });
    },
    async markOrderPaid(input: {
      event: MycashGolisWebhookEvent;
      order: PaymentWebhookOrder;
      cashier: PaymentWebhookCashier;
      paidAt: Date;
    }) {
      await prisma.$transaction(
        async (tx) => {
          const rounds = input.order.rounds?.length
            ? input.order.rounds
            : [{ id: input.order.id, total: input.order.total }];

          await tx.payment.createMany({
            data: rounds.map((round, index) => ({
              orderId: round.id,
              cashierId: input.cashier.id,
              cashierName: input.cashier.fullName,
              method: input.event.provider,
              amountPaid: toDecimal(Number(round.total)),
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
