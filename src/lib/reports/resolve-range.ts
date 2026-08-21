import type { ReportQuery } from "@/lib/reports/validation";
import {
  getBusinessDateRange,
  getBusinessDayRange,
  getReportingMonthRange,
  getReportingWeekRange,
  shiftRange,
  type ReportRange,
} from "@/lib/reports/reporting-calendar";

export function resolveReportRange(
  query: ReportQuery,
  now: Date = new Date(),
): ReportRange {
  if (query.businessDate) {
    return getBusinessDateRange(query.businessDate) ?? getBusinessDayRange(now);
  }
  if (query.preset === "yesterday") return shiftRange(getBusinessDayRange(now), -1);
  if (query.preset === "last7Days") {
    const current = getBusinessDayRange(now);
    return { start: shiftRange(current, -6).start, end: current.end };
  }
  if (query.preset === "thisWeek") return getReportingWeekRange(now);
  if (query.preset === "lastWeek") return shiftRange(getReportingWeekRange(now), -7);
  if (query.preset === "thisMonth") return getReportingMonthRange(now);
  if (query.preset === "lastMonth") {
    const current = getReportingMonthRange(now);
    return getReportingMonthRange(new Date(current.start.getTime() - 86_400_000));
  }
  if (query.preset === "custom" && query.from && query.to) {
    const start = getBusinessDateRange(query.from);
    const end = getBusinessDateRange(query.to);
    if (start && end) return { start: start.start, end: end.end };
  }
  return getBusinessDayRange(now);
}
