import { getCashierBusinessDayRange } from "@/lib/cashier/cashier-business-day";

export const OPENING_READINESS_TASKS = [
  { key: "equipment", label: "Check that brewing equipment is ready" },
  {
    key: "cold_storage",
    label: "Check cold storage and log readings in the required records",
  },
  { key: "stock", label: "Check today's ingredients and disposables" },
  { key: "pos", label: "Check the POS and payment connectivity" },
  { key: "dining", label: "Check the service and dining areas" },
] as const;

/** The opening run follows the existing 07:00 Nairobi cashier-day boundary. */
export function getOpeningBusinessDate(now: Date = new Date()) {
  const { start } = getCashierBusinessDayRange(now);
  return new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
  );
}

export function canSignOffOpeningTasks(
  tasks: readonly { checkedAt: Date | null }[],
) {
  return tasks.length > 0 && tasks.every((task) => task.checkedAt !== null);
}
