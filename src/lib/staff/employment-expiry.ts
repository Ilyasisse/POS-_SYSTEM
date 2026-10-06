import { formatBusinessDate } from "@/lib/reports/reporting-calendar";

export const employmentReviewFilters = ["all", "expiring", "expired"] as const;

export function employmentReviewWindow(now: Date) {
  const today = new Date(`${formatBusinessDate(now)}T00:00:00.000Z`);
  const afterThirtyDays = new Date(today);
  afterThirtyDays.setUTCDate(afterThirtyDays.getUTCDate() + 31);
  return { today, afterThirtyDays };
}

export function employmentReviewFilter(value: string | undefined) {
  return employmentReviewFilters.find((filter) => filter === value) ?? "all";
}
