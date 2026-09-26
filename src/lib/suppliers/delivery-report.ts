import { Prisma } from "@prisma/client";
import { parseBusinessDate } from "@/lib/reports/reporting-calendar";

const DAY_MS = 86_400_000;
const CAFE_OFFSET_MS = 3 * 60 * 60 * 1000;

export function getDeliveryDateBounds(from: string, to: string) {
  if (!parseBusinessDate(from) || !parseBusinessDate(to) || from > to)
    return null;
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  // Delivery timestamps are calendar days, not the 7 AM–5 AM sales period.
  return {
    start: new Date(start.getTime() - CAFE_OFFSET_MS),
    end: new Date(end.getTime() + DAY_MS - CAFE_OFFSET_MS),
  };
}

export function getDefaultDeliveryDates(now = new Date()) {
  const local = new Date(now.getTime() + CAFE_OFFSET_MS);
  const to = local.toISOString().slice(0, 10);
  const from = new Date(local.getTime() - 29 * DAY_MS)
    .toISOString()
    .slice(0, 10);
  return { from, to };
}

export function summarizeDeliveryLines(
  lines: Array<{
    expectedQuantity: Prisma.Decimal.Value;
    receivedQuantity: Prisma.Decimal.Value;
  }>,
) {
  let short = 0;
  let extra = 0;
  for (const line of lines) {
    const difference = new Prisma.Decimal(line.receivedQuantity).minus(
      line.expectedQuantity,
    );
    if (difference.isNegative()) short++;
    if (difference.gt(0)) extra++;
  }
  return { short, extra, matched: lines.length - short - extra };
}
