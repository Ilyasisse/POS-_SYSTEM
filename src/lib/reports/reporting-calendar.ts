export const CAFE_TIMEZONE = "Africa/Nairobi";
export const CAFE_UTC_OFFSET_MINUTES = 180;
export const BUSINESS_DAY_START_MINUTE = 7 * 60;
export const BUSINESS_DAY_END_MINUTE = 5 * 60;
export const REPORTING_WEEK_START_DAY = 6;

const DAY_MS = 86_400_000;
const OFFSET_MS = CAFE_UTC_OFFSET_MINUTES * 60_000;
export type ReportRange = { start: Date; end: Date };
type CafeDate = { year: number; month: number; day: number };

function shifted(date: Date) { return new Date(date.getTime() + OFFSET_MS); }
function cafeDate(date: Date): CafeDate {
  const local = shifted(date);
  return { year: local.getUTCFullYear(), month: local.getUTCMonth() + 1, day: local.getUTCDate() };
}
function utcFromCafe(date: CafeDate, minuteOfDay = 0) {
  return new Date(Date.UTC(date.year, date.month - 1, date.day, Math.floor(minuteOfDay / 60), minuteOfDay % 60) - OFFSET_MS);
}
function addCafeDays(date: CafeDate, days: number): CafeDate {
  const value = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() };
}

export function parseBusinessDate(value: string): CafeDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const result = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const validated = new Date(Date.UTC(result.year, result.month - 1, result.day));
  return validated.getUTCFullYear() === result.year && validated.getUTCMonth() + 1 === result.month && validated.getUTCDate() === result.day ? result : null;
}

export function formatBusinessDate(date: Date) {
  const value = cafeDate(date);
  return `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
}

export function getBusinessDayRange(anchor: Date = new Date()): ReportRange {
  const local = shifted(anchor);
  const minute = local.getUTCHours() * 60 + local.getUTCMinutes();
  let date = cafeDate(anchor);
  if (minute < BUSINESS_DAY_END_MINUTE) date = addCafeDays(date, -1);
  return { start: utcFromCafe(date, BUSINESS_DAY_START_MINUTE), end: utcFromCafe(addCafeDays(date, 1), BUSINESS_DAY_END_MINUTE) };
}

export function getBusinessDateRange(value: string): ReportRange | null {
  const date = parseBusinessDate(value);
  return date ? { start: utcFromCafe(date, BUSINESS_DAY_START_MINUTE), end: utcFromCafe(addCafeDays(date, 1), BUSINESS_DAY_END_MINUTE) } : null;
}

export function getReportingWeekRange(anchor: Date = new Date()): ReportRange {
  const date = cafeDate(getBusinessDayRange(anchor).start);
  const weekday = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
  const startDate = addCafeDays(date, -((weekday - REPORTING_WEEK_START_DAY + 7) % 7));
  return { start: utcFromCafe(startDate, BUSINESS_DAY_START_MINUTE), end: utcFromCafe(addCafeDays(startDate, 7), BUSINESS_DAY_END_MINUTE) };
}

export function getReportingMonthRange(anchor: Date = new Date()): ReportRange {
  const active = cafeDate(getBusinessDayRange(anchor).start);
  const startDate = { year: active.year, month: active.month, day: 1 };
  const next = new Date(Date.UTC(active.year, active.month, 1));
  const endDate = { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: 1 };
  return { start: utcFromCafe(startDate, BUSINESS_DAY_START_MINUTE), end: utcFromCafe(endDate, BUSINESS_DAY_START_MINUTE) };
}

export function shiftRange(range: ReportRange, days: number): ReportRange {
  return { start: new Date(range.start.getTime() + days * DAY_MS), end: new Date(range.end.getTime() + days * DAY_MS) };
}

export function getComparisonRanges(anchor: Date = new Date()) {
  const current = getBusinessDayRange(anchor);
  return { current, yesterday: shiftRange(current, -1), sameWeekdayLastWeek: shiftRange(current, -7) };
}
