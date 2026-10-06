import type {
  KitchenStation,
  KitchenTicket,
  KitchenTicketStatus,
} from "./kitchen-socket";

export type KitchenStatusView = "all" | "new" | "in_progress";

type StatusTicket = Pick<KitchenTicket, "status" | "stationStatuses">;

export function filterKitchenTicketsByStatus<T extends StatusTicket>(
  tickets: readonly T[],
  view: KitchenStatusView,
  station?: KitchenStation,
): T[] {
  if (view === "all") return [...tickets];

  return tickets.filter((ticket) => {
    const status: KitchenTicketStatus = station
      ? (ticket.stationStatuses[station] ?? ticket.status)
      : ticket.status;
    return status === view;
  });
}
