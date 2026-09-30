export type ProductAvailability = {
  availabilityStartMinute: number | null;
  availabilityEndMinute: number | null;
};

const nairobiTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Nairobi",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function getNairobiMinuteOfDay(at: Date) {
  const parts = nairobiTimeFormatter.formatToParts(at);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new Error("Could not resolve the current Nairobi time.");
  }
  return (hour % 24) * 60 + minute;
}

export function isProductAvailableAt(
  product: ProductAvailability,
  at = new Date(),
) {
  const start = product.availabilityStartMinute;
  const end = product.availabilityEndMinute;
  if (start === null && end === null) return true;
  if (start === null || end === null || start === end) return false;

  const minute = getNairobiMinuteOfDay(at);
  return start < end
    ? minute >= start && minute < end
    : minute >= start || minute < end;
}

export function parseTimeToMinute(value: unknown) {
  const text = String(value ?? "").trim();
  const match = /^(\d{2}):(\d{2})$/.exec(text);
  if (!match) throw new Error("Choose a valid start and end time.");
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    throw new Error("Choose a valid start and end time.");
  }
  return hour * 60 + minute;
}

export function parseProductAvailabilityInput(input: {
  mode?: unknown;
  start?: unknown;
  end?: unknown;
}): ProductAvailability {
  if (input.mode !== "SCHEDULED") {
    return { availabilityStartMinute: null, availabilityEndMinute: null };
  }
  const availabilityStartMinute = parseTimeToMinute(input.start);
  const availabilityEndMinute = parseTimeToMinute(input.end);
  if (availabilityStartMinute === availabilityEndMinute) {
    throw new Error("Start and end time must be different.");
  }
  return { availabilityStartMinute, availabilityEndMinute };
}

export function formatAvailabilityMinute(value: number | null) {
  if (value === null) return "";
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
