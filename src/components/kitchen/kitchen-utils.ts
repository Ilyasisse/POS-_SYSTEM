import type { KitchenTicketStatus } from "@/lib/kitchen/kitchen-socket";

export function kitchenStatusColor(status: KitchenTicketStatus) {
  if (status === "done") return "bg-emerald-900/70 text-emerald-200";
  if (status === "in_progress") return "bg-amber-900/70 text-amber-200";
  return "bg-blue-900/70 text-blue-200";
}
