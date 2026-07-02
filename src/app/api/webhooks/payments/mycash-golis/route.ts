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
      return prisma.order.findUnique({
        where: event.orderId
          ? { id: event.orderId }
          : { orderNumber: event.orderNumber ?? 0 },
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
          await tx.payment.create({
            data: {
              orderId: input.order.id,
              cashierId: input.cashier.id,
              cashierName: input.cashier.fullName,
              method: input.event.provider,
              amountPaid: toDecimal(input.event.amount),
              reference: input.event.reference,
              createdAt: input.paidAt,
            },
          });

          await tx.order.update({
            where: { id: input.order.id },
            data: {
              status: "PAID",
              closedAt: input.paidAt,
            },
          });
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
