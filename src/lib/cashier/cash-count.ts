/** Accept an exact, nonnegative amount in the café's two-decimal currency. */
export function parseCashCount(value: string): string | null {
  if (
    !/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(value) ||
    Number(value) > 1_000_000
  )
    return null;
  return value;
}
