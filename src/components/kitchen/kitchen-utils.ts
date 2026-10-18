import type { KitchenTicketStatus } from "@/lib/kitchen/kitchen-socket";

export function kitchenStatusColor(status: KitchenTicketStatus) {
  if (status === "done")
    return "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300";
  if (status === "in_progress")
    return "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300";
  return "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300";
}
