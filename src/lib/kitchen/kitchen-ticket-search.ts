import type { KitchenTicket } from "./kitchen-socket";

type SearchableTicket = Pick<KitchenTicket, "orderNumber" | "tableName"> & {
  items: readonly Pick<KitchenTicket["items"][number], "name">[];
};

export function searchKitchenTickets<T extends SearchableTicket>(
  tickets: readonly T[],
  query: string,
): T[] {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return [...tickets];

  return tickets.filter(
    (ticket) =>
      String(ticket.orderNumber).includes(term) ||
      ticket.tableName?.toLocaleLowerCase().includes(term) ||
      ticket.items.some((item) => item.name.toLocaleLowerCase().includes(term)),
  );
}
