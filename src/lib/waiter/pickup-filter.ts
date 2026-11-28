export type PickupView = "all" | "unclaimed" | "mine";

type PickupSummary = {
  tableName?: string | null;
  orderNumber: number;
  pickupStatus: string;
  claimedByWaiterId?: string | null;
};

export function filterPickupTickets<T extends PickupSummary>(
  tickets: readonly T[],
  search: string,
  view: PickupView,
  currentUserId: string,
): T[] {
  const term = search.trim().toLocaleLowerCase();
  const orderNumber = /^#?[1-9]\d*$/.test(term)
    ? Number(term.replace(/^#/, ""))
    : null;

  return tickets.filter(
    (ticket) =>
      (!term ||
        ticket.tableName?.toLocaleLowerCase().includes(term) ||
        (orderNumber !== null && ticket.orderNumber === orderNumber)) &&
      (view === "all" ||
        (view === "unclaimed" && ticket.pickupStatus === "ready") ||
        (view === "mine" &&
          ticket.pickupStatus === "claimed" &&
          ticket.claimedByWaiterId === currentUserId)),
  );
}
