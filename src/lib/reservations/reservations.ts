export const RESERVATION_STATUSES = [
  "BOOKED",
  "WAITING",
  "SEATED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export type ReservationStatusValue = (typeof RESERVATION_STATUSES)[number];

export function isReservationStatus(
  value: string,
): value is ReservationStatusValue {
  return (RESERVATION_STATUSES as readonly string[]).includes(value);
}

const TRANSITIONS: Record<ReservationStatusValue, ReservationStatusValue[]> = {
  BOOKED: ["WAITING", "SEATED", "CANCELLED", "NO_SHOW"],
  WAITING: ["SEATED", "CANCELLED"],
  SEATED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

function requiredText(value: unknown, label: string, maxLength: number) {
  const text = String(value ?? "").trim();
  if (!text || text.length > maxLength) {
    throw new Error(`${label} must be between 1 and ${maxLength} characters.`);
  }
  return text;
}

function optionalText(value: unknown, label: string, maxLength: number) {
  const text = String(value ?? "").trim();
  if (text.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }
  return text || null;
}

export function parseNairobiDateTime(value: unknown) {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) {
    throw new Error("Choose a valid reservation date and time.");
  }
  const date = new Date(`${text}:00+03:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Choose a valid reservation date and time.");
  }
  return date;
}

export function parseReservationInput(
  input: {
    kind?: unknown;
    guestName?: unknown;
    phone?: unknown;
    partySize?: unknown;
    scheduledAt?: unknown;
    notes?: unknown;
  },
  now = new Date(),
) {
  const kind = input.kind === "WAITLIST" ? "WAITLIST" : "RESERVATION";
  const partySize = Number(input.partySize);
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 50) {
    throw new Error("Party size must be a whole number between 1 and 50.");
  }

  const scheduledAt =
    kind === "RESERVATION" ? parseNairobiDateTime(input.scheduledAt) : null;
  if (scheduledAt && scheduledAt.getTime() < now.getTime() - 15 * 60_000) {
    throw new Error("Reservation time cannot be in the past.");
  }

  return {
    guestName: requiredText(input.guestName, "Guest name", 120),
    phone: optionalText(input.phone, "Phone", 40),
    partySize,
    scheduledAt,
    status: kind === "WAITLIST" ? ("WAITING" as const) : ("BOOKED" as const),
    notes: optionalText(input.notes, "Notes", 1000),
  };
}

export function assertReservationTransition(
  current: ReservationStatusValue,
  next: ReservationStatusValue,
) {
  if (!TRANSITIONS[current].includes(next)) {
    throw new Error(`Reservation cannot move from ${current} to ${next}.`);
  }
}
