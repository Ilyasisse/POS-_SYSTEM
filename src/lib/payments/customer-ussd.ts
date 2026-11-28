export const CUSTOMER_MOBILE_MONEY_ACCOUNT = "430935";

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
  customerName: string;
  amount: number;
  payerPhone: string;
  createdAt: Date;
  expiresAt: Date;
};

/** Compare complete words, ignoring case, spacing, and surrounding punctuation. */
export function customerPaymentNameMatches(
  customerName: string,
  payerLabel: string | null,
): boolean {
  const words = (value: string) =>
    value
      .normalize("NFKC")
      .toLowerCase()
      .match(/\p{L}+(?:['’\-]\p{L}+)*/gu) ?? [];
  const customerWords = new Set(words(customerName));
  const payerWords = new Set(words(payerLabel ?? ""));
  return [...customerWords].filter((word) => payerWords.has(word)).length >= 2;
}

function exactCents(amount: number): number | null {
  const cents = Math.round(amount * 100);
  return Number.isSafeInteger(cents) &&
    cents > 0 &&
    Math.abs(amount * 100 - cents) < 0.0001
    ? cents
    : null;
}

export function chooseUniqueCustomerCheckout(
  receipt: {
    amount: number;
    identifiers: string[];
    counterpartyLabel: string | null;
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
      exactCents(receipt.amount) !== null &&
      exactCents(checkout.amount) === exactCents(receipt.amount) &&
      phones.has(checkout.payerPhone) &&
      customerPaymentNameMatches(
        checkout.customerName,
        receipt.counterpartyLabel,
      ) &&
      receipt.transactionAt.getTime() >= checkout.createdAt.getTime() - 1000 &&
      receipt.transactionAt <= checkout.expiresAt &&
      now <= checkout.expiresAt,
  );
  return matches.length === 1 ? matches[0].id : null;
}

/** Customer input is local digits only; receipts may include the country code. */
export function normalizeCustomerPaymentPhone(value: string): string | null {
  return /^90\d{7}$/.test(value) ? `252${value}` : null;
}
