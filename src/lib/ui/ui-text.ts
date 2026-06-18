import type {
  KitchenStation,
  KitchenTicketStatus,
} from "@/lib/kitchen/kitchen-socket";
import type { SocketStatus } from "@/lib/types";

export function translateSocketStatus(status: SocketStatus): string {
  switch (status) {
    case "connected":
      return "Connected";
    case "connecting":
      return "Connecting";
    case "disconnected":
      return "Disconnected";
    default:
      return status;
  }
}

export function translateKitchenStationName(
  station?: KitchenStation | string | null,
): string {
  switch (station) {
    case "BARISTA":
      return "Barista";
    case "CABITAAN":
      return "Beverages";
    case "FAST_FOOD":
      return "Fast Food";
    case "CUNTO_SOOMAALI":
      return "Somali Food";
    default:
      return "Kitchen";
  }
}

export function translateKitchenTicketStatus(
  status: KitchenTicketStatus,
): string {
  switch (status) {
    case "new":
      return "New";
    case "in_progress":
      return "In Progress";
    case "done":
      return "Done";
    default:
      return status;
  }
}

export function translateUserRole(role?: string | null): string {
  switch (role) {
    case "ADMIN":
      return "Admin";
    case "WAITER":
      return "Waiter";
    case "BARISTA":
      return "Barista";
    case "COOK":
      return "Cook";
    case "Cabitaan":
    case "CABITAAN":
      return "Beverages";
    default:
      return role ?? "";
  }
}

export function translatePaymentMethod(method: string): string {
  switch (method) {
    case "OTHER":
      return "Other";
    default:
      return method;
  }
}
