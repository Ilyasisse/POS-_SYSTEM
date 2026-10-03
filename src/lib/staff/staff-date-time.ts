import {
  CAFE_TIMEZONE,
  CAFE_UTC_OFFSET_MINUTES,
  parseBusinessDate,
} from "@/lib/reports/reporting-calendar";

/** datetime-local fields describe cafe time, regardless of the server's timezone. */
export function parseStaffDateTime(value: string): Date {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    value,
  );
  const date = match && parseBusinessDate(match[1]);
  if (
    !match ||
    !date ||
    Number(match[2]) > 23 ||
    Number(match[3]) > 59 ||
    Number(match[4] ?? 0) > 59
  ) {
    throw new Error("Enter a valid shift date and time.");
  }
  return new Date(
    Date.UTC(
      date.year,
      date.month - 1,
      date.day,
      Number(match[2]),
      Number(match[3]),
      Number(match[4] ?? 0),
    ) -
      CAFE_UTC_OFFSET_MINUTES * 60_000,
  );
}

export function formatStaffDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en-KE", {
    timeZone: CAFE_TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}
