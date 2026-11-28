import { PERMISSIONS } from "@/lib/auth/permissions";
import type { ExportReport } from "@/lib/reports/export-service";

export const reportPermissions = {
  daily: PERMISSIONS.REPORT_DAILY_VIEW,
  weekly: PERMISSIONS.REPORT_WEEKLY_VIEW,
  monthly: PERMISSIONS.REPORT_MONTHLY_VIEW,
} as const;

export const exportReportPermissions = {
  sales: PERMISSIONS.REPORT_DAILY_VIEW,
  inventory: PERMISSIONS.REPORT_INVENTORY_VIEW,
  staff: PERMISSIONS.REPORT_STAFF_VIEW,
  kitchen: PERMISSIONS.REPORT_KITCHEN_VIEW,
  customers: PERMISSIONS.REPORT_CUSTOMER_VIEW,
  suppliers: PERMISSIONS.REPORT_SUPPLIER_VIEW,
  finance: PERMISSIONS.REPORT_FINANCIAL_VIEW,
  operations: PERMISSIONS.REPORT_OPERATIONS_VIEW,
} as const satisfies Record<ExportReport, string>;
