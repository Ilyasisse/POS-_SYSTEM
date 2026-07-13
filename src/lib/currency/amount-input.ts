const NONNEGATIVE_CURRENCY_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const SIGNED_CURRENCY_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;

export type CurrencyParseOptions = {
  allowNegative?: boolean;
  requireNonPositive?: boolean;
};

export function parseCurrencyAmount(
  value: FormDataEntryValue | string | number | null | undefined,
  options: CurrencyParseOptions = {},
) {
  const input = String(value ?? "").trim();
  if (!input) return null;

  const pattern = options.allowNegative
    ? SIGNED_CURRENCY_PATTERN
    : NONNEGATIVE_CURRENCY_PATTERN;

  if (!pattern.test(input)) return null;

  const amount = Number(input);
  if (!Number.isFinite(amount)) return null;
  if (!options.allowNegative && amount < 0) return null;
  if (options.requireNonPositive && amount > 0) return null;

  return Object.is(amount, -0) ? 0 : amount;
}

export function hasCurrencyPrecision(value: number) {
  if (!Number.isFinite(value)) return false;
  const cents = Number((value * 100).toFixed(8));
  return Number.isInteger(cents);
}
