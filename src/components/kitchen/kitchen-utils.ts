import type {
  KitchenSocketMessage,
  KitchenTicketStatus,
} from "@/lib/kitchen/kitchen-socket";

export function parseKitchenMessage(
  raw: string,
): KitchenSocketMessage | null {
  try {
    return JSON.parse(raw) as KitchenSocketMessage;
  } catch {
    return null;
  }
}

export function kitchenStatusColor(status: KitchenTicketStatus) {
  if (status === "new") {
    return "bg-blue-100 text-blue-700";
  }

  if (status === "in_progress") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-green-100 text-green-700";
}