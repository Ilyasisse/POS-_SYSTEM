type ClockEvidence = { type: "IN" | "OUT"; occurredAt: Date };

/** Pick one complete clock session that actually overlaps the scheduled shift. */
export function selectAttendanceSession(input: {
  startsAt: Date;
  endsAt: Date;
  events: readonly ClockEvidence[];
}) {
  let clockIn: Date | null = null;
  let selected: { clockIn: Date; clockOut: Date } | null = null;
  let greatestOverlap = 0;
  for (const event of [...input.events].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
  )) {
    if (event.type === "IN") {
      clockIn = event.occurredAt;
      continue;
    }
    if (!clockIn) continue;
    const overlap =
      Math.min(event.occurredAt.getTime(), input.endsAt.getTime()) -
      Math.max(clockIn.getTime(), input.startsAt.getTime());
    if (event.occurredAt > clockIn && overlap > greatestOverlap) {
      selected = { clockIn, clockOut: event.occurredAt };
      greatestOverlap = overlap;
    }
    clockIn = null;
  }
  return selected;
}
