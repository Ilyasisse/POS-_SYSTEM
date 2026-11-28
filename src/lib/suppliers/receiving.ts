import { Prisma } from "@prisma/client";

export type DeliveryLine = { id: string; quantity: Prisma.Decimal.Value };

const QUANTITY = /^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/;
const MAX_QUANTITY = new Prisma.Decimal("999999999.999");

export function validateReceivedQuantities(
  ordered: DeliveryLine[],
  entries: Array<{ id: string; quantity: string }>,
):
  | {
      ok: true;
      rows: Array<{
        id: string;
        expected: Prisma.Decimal;
        received: Prisma.Decimal;
      }>;
      hasDifference: boolean;
    }
  | { ok: false; message: string } {
  if (!ordered.length || ordered.length !== entries.length)
    return {
      ok: false,
      message: "Enter a received quantity for every ordered item.",
    };

  const input = new Map<string, Prisma.Decimal>();
  for (const entry of entries) {
    const value = entry.quantity.trim();
    if (input.has(entry.id) || !QUANTITY.test(value))
      return {
        ok: false,
        message:
          "Each item needs one non-negative quantity with up to three decimal places.",
      };
    const quantity = new Prisma.Decimal(value);
    if (quantity.gt(MAX_QUANTITY))
      return { ok: false, message: "A received quantity is too large." };
    input.set(entry.id, quantity);
  }

  const rows = [];
  let hasDifference = false;
  for (const item of ordered) {
    const received = input.get(item.id);
    if (!received)
      return {
        ok: false,
        message: "The order items changed. Refresh and recount the delivery.",
      };
    const expected = new Prisma.Decimal(item.quantity);
    hasDifference ||= !received.eq(expected);
    rows.push({ id: item.id, expected, received });
  }
  return { ok: true, rows, hasDifference };
}

export function deliveryDifference(
  expected: Prisma.Decimal.Value,
  received: Prisma.Decimal.Value,
) {
  const delta = new Prisma.Decimal(received).minus(expected);
  return {
    quantity: delta.abs().toFixed(3),
    status: delta.isZero() ? "Matched" : delta.isNegative() ? "Short" : "Extra",
  };
}
