import type { OrderType } from "@prisma/client";

export function parseCounterOrderType(value: unknown): OrderType | null {
  return value == null || value === "" || value === "TAKEOUT" ? "TAKEOUT" : null;
}
