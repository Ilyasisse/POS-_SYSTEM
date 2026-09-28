export function priceChangeReasonError(changed: boolean, reason: string) {
  if (!changed) return null;
  const length = reason.trim().length;
  return length >= 3 && length <= 300
    ? null
    : "Explain the price change in 3 to 300 characters.";
}

export function recordedPrice(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "—";
  if (!("price" in value)) return "—";
  const raw = value.price;
  if (typeof raw !== "string" && typeof raw !== "number") return "—";
  const price = Number(raw);
  return Number.isFinite(price) ? `$${raw}` : "—";
}
