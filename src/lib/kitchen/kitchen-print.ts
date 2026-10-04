import {
  getKitchenTicketStatusForItems,
  normalizeKitchenStation,
  type KitchenStation,
  type KitchenTicket,
  type KitchenTicketFilter,
} from "@/lib/kitchen/kitchen-socket";

const STATION_LABELS: Record<KitchenStation, string> = {
  CUNTO_SOOMAALI: "Cunto Soomaali",
  FAST_FOOD: "Fast Food",
  CABITAAN: "Cabitaan",
  BARISTA: "Barista",
};

export function kitchenStationLabel(station: KitchenStation) {
  return STATION_LABELS[station];
}

export function buildKitchenPrintHref(
  orderId: string,
  station?: KitchenStation | null,
) {
  const base = `/print/kitchen/${encodeURIComponent(orderId)}`;
  return station ? `${base}?station=${encodeURIComponent(station)}` : base;
}

/** Applies viewer scope without the live queue's completion/pickup restrictions. */
export function filterPrintableKitchenTicket(
  ticket: KitchenTicket,
  filter: KitchenTicketFilter,
): KitchenTicket | null {
  const station = normalizeKitchenStation(filter.station);
  if (filter.role !== "ADMIN" && !station) return null;

  let items = station
    ? ticket.items.filter((item) => item.station === station)
    : ticket.items;
  if (station === "BARISTA" && filter.role === "BARISTA") {
    if (!filter.userId) return null;
    items = items.filter((item) => item.assignedUserId === filter.userId);
  }
  if (!items.length) return null;

  return {
    ...ticket,
    items,
    status: getKitchenTicketStatusForItems(ticket, items),
  };
}
