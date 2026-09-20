export const CUSTOMER_MOBILE_MONEY_ACCOUNT = "43095";

export function normalizeSomaliPhone(value: string): string | null {
  const trimmed = value.trim();
  if (!/^[+\d\s()-]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");
  const national = digits.startsWith("252")
    ? digits.slice(3)
    : digits.startsWith("0")
      ? digits.slice(1)
      : digits;
  return /^\d{9}$/.test(national) ? `252${national}` : null;
}

export function formatCustomerUssdAmount(amount: number): string {
  const cents = Math.round(amount * 100);
  if (
    !Number.isFinite(amount) ||
    cents <= 0 ||
    Math.abs(amount * 100 - cents) > 0.0001
  ) {
    throw new Error("Invalid checkout amount.");
  }
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

export function customerUssdCode(amount: number): string {
  return `*884*${CUSTOMER_MOBILE_MONEY_ACCOUNT}*${formatCustomerUssdAmount(amount)}#`;
}

export function androidDialerHref(code: string): string {
  return `tel:${code.replaceAll("#", "%23")}`;
}

export function isAndroidDevice(userAgent: string): boolean {
  return /Android/i.test(userAgent);
}

export type CheckoutMatchCandidate = {
  id: string;
  amount: number;
  payerPhone: string;
  createdAt: Date;
  expiresAt: Date;
};

export function chooseUniqueCustomerCheckout(
  receipt: {
    amount: number;
    identifiers: string[];
    transactionAt: Date;
  },
  candidates: CheckoutMatchCandidate[],
  now: Date,
): string | null {
  const phones = new Set(
    receipt.identifiers
      .map(normalizeSomaliPhone)
      .filter((value): value is string => Boolean(value)),
  );
  if (phones.size === 0) return null;
  const matches = candidates.filter(
    (checkout) =>
      Math.round(checkout.amount * 100) === Math.round(receipt.amount * 100) &&
      phones.has(checkout.payerPhone) &&
      receipt.transactionAt.getTime() >= checkout.createdAt.getTime() - 1000 &&
      receipt.transactionAt <= checkout.expiresAt &&
      now <= checkout.expiresAt,
  );
  return matches.length === 1 ? matches[0].id : null;
}
