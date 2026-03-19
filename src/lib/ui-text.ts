import type {
  KitchenStation,
  KitchenTicketStatus,
} from "@/lib/kitchen-socket";
import type { SocketStatus } from "@/lib/types";

export function translateSocketStatus(status: SocketStatus): string {
  switch (status) {
    case "connected":
      return "Xiran";
    case "connecting":
      return "Isku xiraya";
    case "disconnected":
      return "Go'an";
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
      return "Cabitaan";
    case "FAST_FOOD":
      return "Cunto Degdeg ah";
    case "CUNTO_SOOMAALI":
      return "Cunto Soomaali";
    default:
      return "Jiko";
  }
}

export function translateKitchenTicketStatus(
  status: KitchenTicketStatus,
): string {
  switch (status) {
    case "new":
      return "Cusub";
    case "in_progress":
      return "Socda";
    case "done":
      return "Dhammaystiran";
    default:
      return status;
  }
}

export function translateUserRole(role?: string | null): string {
  switch (role) {
    case "ADMIN":
      return "Maamule";
    case "WAITER":
      return "Adeege";
    case "BARISTA":
      return "Barista";
    case "COOK":
      return "Cunto kariye";
    case "Cabitaan":
    case "CABITAAN":
      return "Cabitaan";
    default:
      return role ?? "";
  }
}

export function translatePaymentMethod(method: string): string {
  switch (method) {
    case "OTHER":
      return "Kale";
    default:
      return method;
  }
}
