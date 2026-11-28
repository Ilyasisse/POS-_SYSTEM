import { getTodaySupplyDateKey, isValidSupplyDateKey } from "@/lib/supplies/supply-purchases";

export function inventoryDateRange(date: string) {
  if (!isValidSupplyDateKey(date)) throw new Error("Choose a valid inventory date.");
  const start = new Date(`${date}T00:00:00+03:00`);
  return { gte: start, lt: new Date(start.getTime() + 86_400_000) };
}

export function inventoryMovementDate(value: FormDataEntryValue | null, now = new Date()) {
  const today = getTodaySupplyDateKey(now);
  // Old clients omit the field; an explicitly empty or malformed field is invalid.
  const date = value === null ? today : String(value);
  if (!isValidSupplyDateKey(date) || date > today)
    throw new Error("Choose a valid inventory date that is not in the future.");
  return date === today ? now : new Date(`${date}T12:00:00+03:00`);
}
