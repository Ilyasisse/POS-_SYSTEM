import type { CashDrawerDirection } from "@prisma/client";

export function parseCashDrawerMovement(input: {
  direction: string;
  amount: string;
  reason: string;
  idempotencyKey: string;
}): {
  direction: CashDrawerDirection;
  amount: string;
  reason: string;
  idempotencyKey: string;
} | null {
  const reason = input.reason.trim();
  if (
    (input.direction !== "IN" && input.direction !== "OUT") ||
    !/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(input.amount) ||
    Number(input.amount) <= 0 ||
    Number(input.amount) > 1_000_000 ||
    reason.length < 3 ||
    reason.length > 250 ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      input.idempotencyKey,
    )
  ) {
    return null;
  }
  return {
    ...input,
    direction: input.direction as CashDrawerDirection,
    reason,
  };
}
