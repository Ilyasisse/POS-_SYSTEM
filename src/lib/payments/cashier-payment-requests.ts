import { Prisma, type PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const cents = (value: unknown) => Math.round(Number(value) * 100);
const decimal = (value: number) => new Prisma.Decimal(value);

export type PaymentRequestLineInput = { payerName: string; payerPhone: string; amount: number };

export async function getOpenTableBalance(tableId: string) {
  const orders = await prisma.order.findMany({
    where: { tableId, type: "DINE_IN", status: "OPEN" },
    orderBy: { createdAt: "asc" },
    include: { payments: { select: { amountPaid: true } } },
  });
  return orders.reduce((sum, order) => sum + Math.max(0, cents(order.total) - order.payments.reduce((paid, payment) => paid + cents(payment.amountPaid), 0)), 0);
}

export async function createPaymentRequestBatch(input: {
  batchKey: string; tableId: string; cashier: { id: string; fullName: string };
  method: PaymentMethod; lines: PaymentRequestLineInput[]; payLater: boolean;
}) {
  const existing = await prisma.paymentRequest.findMany({ where: { batchKey: input.batchKey }, orderBy: { lineIndex: "asc" } });
  if (existing.length) return existing;
  const dueCents = await getOpenTableBalance(input.tableId);
  if (dueCents <= 0) throw new Error("This table no longer has an unpaid balance.");
  const lines = input.lines.map((line) => ({ payerName: line.payerName.trim(), payerPhone: line.payerPhone.trim(), amountCents: cents(line.amount) }));
  if (!lines.length || lines.some((line) => !line.payerName || !line.payerPhone || line.amountCents <= 0)) {
    throw new Error("Every payment needs a name, phone number, and amount.");
  }
  const requestedCents = lines.reduce((sum, line) => sum + line.amountCents, 0);
  if (requestedCents > dueCents) throw new Error("Split payments cannot exceed the table balance.");
  if (requestedCents < dueCents && !input.payLater) throw new Error("Add another payer or choose Pay later for the remaining balance.");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  return prisma.$transaction(async (tx) => {
    const requests = await Promise.all(lines.map((line, lineIndex) => tx.paymentRequest.create({
      data: { batchKey: input.batchKey, lineIndex, tableId: input.tableId, cashierId: input.cashier.id,
        cashierName: input.cashier.fullName, method: input.method, payerName: line.payerName,
        payerPhone: line.payerPhone, expectedAmount: decimal(line.amountCents / 100), expiresAt },
    })));
    if (requestedCents < dueCents) {
      await tx.paymentDeferral.create({ data: { batchKey: input.batchKey, tableId: input.tableId,
        cashierId: input.cashier.id, cashierName: input.cashier.fullName, amountDue: decimal(dueCents / 100),
        amountPaid: decimal(requestedCents / 100), remainingAmount: decimal((dueCents - requestedCents) / 100) } });
    }
    return requests;
  });
}

export async function matchPaymentRequest(input: {
  paymentRequestId?: string; payerPhone?: string; provider?: PaymentMethod;
  reference: string; amount: number; sender: string; rawMessage: string; paidAt?: Date;
}) {
  if (!input.reference.trim()) throw new Error("Payment reference is required.");
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Payment amount must be greater than zero.");
  const expectedSender = process.env.MACRODROID_PAYMENT_SMS_SENDER?.trim() || "A98";
  if (input.sender.trim().toUpperCase() !== expectedSender.toUpperCase()) throw new Error("The SMS sender is not allowed.");
  const paidAt = input.paidAt ?? new Date();
  return prisma.$transaction(async (tx) => {
    let request = input.paymentRequestId
      ? await tx.paymentRequest.findUnique({ where: { id: input.paymentRequestId } })
      : null;
    if (!request && input.payerPhone && input.provider) {
      const candidates = await tx.paymentRequest.findMany({ where: {
        status: "PENDING", method: input.provider, payerPhone: input.payerPhone.trim(),
        expectedAmount: decimal(cents(input.amount) / 100), expiresAt: { gt: paidAt },
      }, orderBy: { createdAt: "asc" }, take: 2 });
      if (candidates.length > 1) throw new Error("Payment matches more than one pending request; send paymentRequestId.");
      request = candidates[0] ?? null;
    }
    if (!request) throw new Error("Payment request not found.");
    if (request.status === "MATCHED") return { duplicate: true, request };
    if (request.status !== "PENDING" || request.expiresAt < paidAt) throw new Error("Payment request is no longer active.");
    if (cents(request.expectedAmount) !== cents(input.amount)) throw new Error("Payment amount does not match the selected payer amount.");
    const duplicate = await tx.paymentRequest.findFirst({ where: { method: request.method, providerReference: input.reference } });
    if (duplicate) return { duplicate: true, request: duplicate };
    const orders = await tx.order.findMany({ where: { tableId: request.tableId, type: "DINE_IN", status: "OPEN" },
      orderBy: { createdAt: "asc" }, include: { payments: { select: { amountPaid: true } } } });
    let remainingCents = cents(input.amount);
    for (const order of orders) {
      if (remainingCents <= 0) break;
      const paidCents = order.payments.reduce((sum, payment) => sum + cents(payment.amountPaid), 0);
      const orderRemaining = Math.max(0, cents(order.total) - paidCents);
      const allocation = Math.min(orderRemaining, remainingCents);
      if (!allocation) continue;
      await tx.payment.create({ data: { orderId: order.id, cashierId: request.cashierId, cashierName: request.cashierName,
        method: request.method, amountPaid: decimal(allocation / 100), reference: `${input.reference}:${order.id}`,
        payerName: request.payerName, payerPhone: request.payerPhone, paymentRequestId: request.id, createdAt: paidAt } });
      remainingCents -= allocation;
      if (allocation === orderRemaining) await tx.order.update({ where: { id: order.id }, data: { status: "PAID", closedAt: paidAt } });
    }
    if (remainingCents > 0) throw new Error("Payment exceeds the remaining table balance.");
    const matched = await tx.paymentRequest.update({ where: { id: request.id }, data: {
      status: "MATCHED", providerReference: input.reference, rawMessage: input.rawMessage, matchedAt: paidAt } });
    const openOrderCount = await tx.order.count({ where: {
      tableId: request.tableId, type: "DINE_IN", status: "OPEN",
    } });
    if (openOrderCount === 0) {
      await tx.paymentDeferral.updateMany({
        where: { tableId: request.tableId, resolvedAt: null },
        data: { resolvedAt: paidAt },
      });
    }
    return { duplicate: false, request: matched };
  });
}
