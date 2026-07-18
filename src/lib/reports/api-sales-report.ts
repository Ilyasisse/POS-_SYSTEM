import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/api-authorization";
import { hasPermission, PERMISSIONS, type Permission } from "@/lib/auth/permissions";
import { getSalesReport } from "@/lib/reports/services/sales-report-service";
import { resolveReportRange } from "@/lib/reports/resolve-range";
import { reportQuerySchema } from "@/lib/reports/validation";

export async function salesReportResponse(
  request: Request,
  permission: Permission,
  select: "all" | "products" = "all",
) {
  const authorization = await authorizeApi(permission);
  if (!authorization.ok) return authorization.response;
  const url = new URL(request.url);
  const parsed = reportQuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid report filters.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const report = await getSalesReport(resolveReportRange(parsed.data), parsed.data);
  const authorizedReport = hasPermission(
    authorization.user,
    PERMISSIONS.REPORT_FINANCIAL_VIEW,
  )
    ? report
    : {
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
  return NextResponse.json(
    select === "products"
      ? { period: authorizedReport.period, summary: authorizedReport.summary, products: authorizedReport.products }
      : authorizedReport,
  );
}
