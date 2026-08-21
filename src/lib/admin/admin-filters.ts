export function normalizeFilterChoice<const Values extends readonly string[]>(
  value: string | undefined,
  allowedValues: Values,
  fallback: Values[number],
): Values[number] {
  return allowedValues.includes(value as Values[number])
    ? (value as Values[number])
    : fallback;
}

export function isValidDateKey(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function normalizeDateFilter(
  value: string | undefined,
  fallback: string,
  bounds: { min?: string; max?: string } = {},
) {
  if (!isValidDateKey(value)) return fallback;
  if (bounds.min && value < bounds.min) return fallback;
  if (bounds.max && value > bounds.max) return fallback;
  return value;
}
