import type { PaymentMethod } from "@prisma/client";

export const POS_PAYMENT_METHODS = [
  "CASH",
  "MYCASH",
  "GOLIS",
  "Dahabshiil",
  "OTHER",
] as const satisfies readonly PaymentMethod[];

export const RECEIPT_MATCH_PAYMENT_METHODS = [
  "MYCASH",
  "GOLIS",
  "Dahabshiil",
  "OTHER",
] as const satisfies readonly PaymentMethod[];

export function isPosPaymentMethod(value: string): value is PaymentMethod {
  return (POS_PAYMENT_METHODS as readonly string[]).includes(value);
}

export function isReceiptMatchPaymentMethod(
  value: string,
): value is PaymentMethod {
  return (RECEIPT_MATCH_PAYMENT_METHODS as readonly string[]).includes(value);
}

export function remainingPaymentAmount(
  total: number,
  priorPayments: readonly number[],
) {
  const totalCents = Math.round(total * 100);
  const paidCents = priorPayments.reduce(
    (sum, payment) => sum + Math.round(payment * 100),
    0,
  );
  return Math.max(0, totalCents - paidCents) / 100;
}
