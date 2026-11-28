import {
  hasPermission,
  PERMISSIONS,
  type PermissionUser,
} from "@/lib/auth/permissions";
import type { getSalesReport } from "@/lib/reports/services/sales-report-service";

export function visibleSalesReport(
  report: Awaited<ReturnType<typeof getSalesReport>>,
  user: Pick<PermissionUser, "role">,
) {
  if (hasPermission(user, PERMISSIONS.REPORT_FINANCIAL_VIEW)) return report;
  return {
    ...report,
    summary: {
      ...report.summary,
      cogs: null,
      grossProfit: null,
      grossMargin: null,
      costCoveragePercent: null,
      costCoveredLines: 0,
      totalLines: 0,
    },
    categories: report.categories.map((row) => ({
      id: row.id,
      name: row.name,
      quantity: row.quantity,
      grossSales: row.grossSales,
      missingCostLines: row.missingCostLines,
    })),
    products: report.products.map((row) => ({
      id: row.id,
      name: row.name,
      quantity: row.quantity,
      grossSales: row.grossSales,
      missingCostLines: row.missingCostLines,
    })),
  };
}
