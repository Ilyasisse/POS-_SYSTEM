import { Prisma, type PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  preparePaymentRequestLines,
  type PaymentRequestLineDraft,
} from "@/lib/payments/payment-request-lines";

const cents = (value: unknown) => Math.round(Number(value) * 100);
const decimal = (value: number) => new Prisma.Decimal(value);

export type PaymentRequestLineInput = PaymentRequestLineDraft;

async function getOpenTableBalance(
  tx: Pick<Prisma.TransactionClient, "order">,
  tableId: string,
) {
  const orders = await tx.order.findMany({
    where: { tableId, type: "DINE_IN", status: "OPEN" },
    orderBy: { createdAt: "asc" },
    include: { payments: { select: { amountPaid: true } } },
  });
  return orders.reduce(
    (sum, order) =>
      sum +
      Math.max(
        0,
        cents(order.total) -
          order.payments.reduce(
            (paid, payment) => paid + cents(payment.amountPaid),
            0,
          ),
      ),
    0,
  );
}

export async function createPaymentRequestBatch(input: {
  batchKey: string;
  tableId: string;
  cashier: { id: string; fullName: string };
  method?: PaymentMethod;
  lines: PaymentRequestLineInput[];
  payLater: boolean;
}) {
  const existing = await prisma.paymentRequest.findMany({
    where: { batchKey: input.batchKey },
    orderBy: { lineIndex: "asc" },
  });
  if (existing.length) return existing;
  return prisma.$transaction(async (tx) => {
    // Serialize payer creation with table transfers and settlement.
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "Table" WHERE "id" = ${input.tableId} FOR UPDATE`,
    );
    const existingAfterLock = await tx.paymentRequest.findMany({
      where: { batchKey: input.batchKey },
      orderBy: { lineIndex: "asc" },
    });
    if (existingAfterLock.length) return existingAfterLock;
    const dueCents = await getOpenTableBalance(tx, input.tableId);
    if (dueCents <= 0)
      throw new Error("This table no longer has an unpaid balance.");
    const lines = preparePaymentRequestLines(input.lines, input.method);
    const requestedCents = lines.reduce((sum, line) => sum + line.amountCents, 0);
    if (requestedCents > dueCents)
      throw new Error("Split payments cannot exceed the table balance.");
    if (requestedCents < dueCents && !input.payLater)
      throw new Error(
        "Add another payer or choose Pay later for the remaining balance.",
      );
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const requests = await Promise.all(
      lines.map((line, lineIndex) =>
        tx.paymentRequest.create({
          data: {
            batchKey: input.batchKey,
            lineIndex,
            tableId: input.tableId,
            cashierId: input.cashier.id,
            cashierName: input.cashier.fullName,
            method: line.method,
            payerName: line.payerName,
            payerPhone: line.payerPhone,
            expectedAmount: decimal(line.amountCents / 100),
            expiresAt,
          },
        }),
      ),
    );
    if (requestedCents < dueCents) {
      await tx.paymentDeferral.create({
        data: {
          batchKey: input.batchKey,
          tableId: input.tableId,
          cashierId: input.cashier.id,
          cashierName: input.cashier.fullName,
          amountDue: decimal(dueCents / 100),
          amountPaid: decimal(requestedCents / 100),
          remainingAmount: decimal((dueCents - requestedCents) / 100),
        },
      });
    }
    return requests;
  });
}
