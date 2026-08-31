import type { PaymentMethod } from "@prisma/client";

export const PAYMENT_METHODS = [
  "MYCASH",
  "GOLIS",
  "Dahabshiil",
  "OTHER",
] as const satisfies readonly PaymentMethod[];

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return PAYMENT_METHODS.includes(value as PaymentMethod);
}

export type PaymentRequestLineDraft = {
  payerName: string;
  payerPhone: string;
  amount: number;
  method?: PaymentMethod | string;
};

export function preparePaymentRequestLines(
  lines: readonly PaymentRequestLineDraft[],
  fallbackMethod?: PaymentMethod,
) {
  const prepared = lines.map((line) => ({
    payerName: line.payerName.trim(),
    payerPhone: line.payerPhone.trim(),
    amountCents: Math.round(Number(line.amount) * 100),
    method: isPaymentMethod(line.method) ? line.method : fallbackMethod,
  }));

  if (!prepared.length) {
    throw new Error("Add at least one payer.");
  }
  if (
    prepared.some(
      (line) =>
        !line.payerName ||
        !line.payerPhone ||
        !Number.isInteger(line.amountCents) ||
        line.amountCents <= 0 ||
        !line.method,
    )
  ) {
    throw new Error(
      "Every payment needs a method, name, phone number, and amount.",
    );
  }

  return prepared as Array<
    Omit<(typeof prepared)[number], "method"> & { method: PaymentMethod }
  >;
}
