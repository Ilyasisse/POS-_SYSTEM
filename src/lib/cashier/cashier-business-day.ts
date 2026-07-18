import { getBusinessDayRange } from "@/lib/reports/reporting-calendar";

const businessDayDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "Africa/Nairobi",
});

const businessDayTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Africa/Nairobi",
});

export function getCashierBusinessDayRange(now: Date = new Date()) {
  return getBusinessDayRange(now);
}

export function formatCashierBusinessDayRange(start: Date, end: Date) {
  return `${businessDayDateFormatter.format(start)} ${businessDayTimeFormatter.format(start)} to ${businessDayDateFormatter.format(end)} ${businessDayTimeFormatter.format(end)}`;
}
