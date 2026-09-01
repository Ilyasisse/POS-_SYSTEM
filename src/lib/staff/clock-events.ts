export const CLOCK_EVENT_TYPES = ["IN", "BREAK_START", "BREAK_END", "OUT"] as const;
export type ClockEventValue = (typeof CLOCK_EVENT_TYPES)[number];

const NEXT_ACTIONS: Record<ClockEventValue | "NONE", readonly ClockEventValue[]> = {
  NONE: ["IN"],
  IN: ["BREAK_START", "OUT"],
  BREAK_START: ["BREAK_END"],
  BREAK_END: ["BREAK_START", "OUT"],
  OUT: ["IN"],
};

export function allowedClockActions(lastType: ClockEventValue | null) {
  return NEXT_ACTIONS[lastType ?? "NONE"];
}

export function assertClockTransition(
  lastType: ClockEventValue | null,
  nextType: ClockEventValue,
) {
  if (!allowedClockActions(lastType).includes(nextType)) {
    throw new Error(`Cannot record ${nextType} after ${lastType ?? "no clock event"}.`);
  }
}

export function calculateCompletedBreakMinutes(
  events: readonly { type: ClockEventValue; occurredAt: Date }[],
) {
  let breakStartedAt: Date | null = null;
  let totalMilliseconds = 0;
  for (const event of events) {
    if (event.type === "BREAK_START" && breakStartedAt === null) {
      breakStartedAt = event.occurredAt;
    } else if (
      event.type === "BREAK_END" &&
      breakStartedAt !== null &&
      event.occurredAt > breakStartedAt
    ) {
      totalMilliseconds += event.occurredAt.getTime() - breakStartedAt.getTime();
      breakStartedAt = null;
    }
  }
  return Math.floor(totalMilliseconds / 60_000);
}
