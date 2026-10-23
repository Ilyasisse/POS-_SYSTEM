import type { KitchenTicket } from "@/lib/kitchen/kitchen-socket";

export function latestPickupReadyAt(
  events: readonly { type: string; occurredAt: Date }[],
) {
  return events
    .filter((event) => event.type === "PICKUP_READY")
    .reduce<Date | null>(
      (latest, event) =>
        !latest || event.occurredAt > latest ? event.occurredAt : latest,
      null,
    );
}

export function sortWaiterPickupTickets<
  T extends Pick<
    KitchenTicket,
    "id" | "readyAt" | "pickupStatus" | "createdAt"
  >,
>(tickets: readonly T[]): T[] {
  return [...tickets].sort((left, right) => {
    const leftClaimed = left.pickupStatus === "claimed" ? 1 : 0;
    const rightClaimed = right.pickupStatus === "claimed" ? 1 : 0;
    if (leftClaimed !== rightClaimed) return leftClaimed - rightClaimed;
    const leftReady = left.readyAt ? Date.parse(left.readyAt) : NaN;
    const rightReady = right.readyAt ? Date.parse(right.readyAt) : NaN;
    const leftTime = Number.isFinite(leftReady) ? leftReady : Infinity;
    const rightTime = Number.isFinite(rightReady) ? rightReady : Infinity;
    if (leftTime !== rightTime) return leftTime - rightTime;
    const leftCreated = Date.parse(left.createdAt);
    const rightCreated = Date.parse(right.createdAt);
    return (
      (Number.isFinite(leftCreated) ? leftCreated : Infinity) -
        (Number.isFinite(rightCreated) ? rightCreated : Infinity) ||
      left.id.localeCompare(right.id)
    );
  });
}

export function formatPickupWait(
  readyAt: string | null | undefined,
  nowMs: number,
) {
  const readyMs = readyAt ? Date.parse(readyAt) : NaN;
  if (!Number.isFinite(readyMs)) return "Ready time unavailable";
  const minutes = Math.max(0, Math.floor((nowMs - readyMs) / 60000));
  return minutes === 0 ? "Ready just now" : `Waiting ${minutes} min`;
}
