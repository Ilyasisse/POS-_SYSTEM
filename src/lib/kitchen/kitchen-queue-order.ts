import type { KitchenTicket } from "@/lib/kitchen/kitchen-socket";

/** Creation transitions start the station queue; edits do not restart its age. */
export function earliestKitchenQueueEntry(
  events: readonly { type: string; occurredAt: Date }[],
) {
  return events.reduce<Date | null>(
    (first, event) =>
      event.type === "STATION_CREATED" && (!first || event.occurredAt < first)
        ? event.occurredAt
        : first,
    null,
  );
}

export function sortKitchenQueueOldestFirst<
  T extends Pick<KitchenTicket, "id" | "queueEnteredAt" | "createdAt">,
>(tickets: readonly T[]): T[] {
  function queueTime(ticket: T) {
    const queueEntered = ticket.queueEnteredAt
      ? Date.parse(ticket.queueEnteredAt)
      : NaN;
    if (Number.isFinite(queueEntered)) return queueEntered;
    const created = Date.parse(ticket.createdAt);
    return Number.isFinite(created) ? created : Infinity;
  }

  return [...tickets].sort(
    (left, right) =>
      queueTime(left) - queueTime(right) || left.id.localeCompare(right.id),
  );
}
