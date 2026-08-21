import { PERMISSIONS } from "@/lib/auth/permissions";

export const reportPermissions = {
  daily: PERMISSIONS.REPORT_DAILY_VIEW,
  weekly: PERMISSIONS.REPORT_WEEKLY_VIEW,
  monthly: PERMISSIONS.REPORT_MONTHLY_VIEW,
} as const;
