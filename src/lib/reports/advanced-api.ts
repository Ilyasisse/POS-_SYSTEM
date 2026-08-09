import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/api-authorization";
import type { Permission } from "@/lib/auth/permissions";
import { resolveReportRange } from "@/lib/reports/resolve-range";
import { reportQuerySchema } from "@/lib/reports/validation";
import { getCustomerReport, getFinanceReport, getInventoryReport, getKitchenReport, getOperationsReport, getStaffReport, getSupplierReport } from "@/lib/reports/services/advanced-report-service";

type AdvancedReport = "inventory" | "staff" | "kitchen" | "customers" | "suppliers" | "finance" | "operations";
const handlers = { inventory: getInventoryReport, staff: getStaffReport, kitchen: getKitchenReport, customers: getCustomerReport, suppliers: getSupplierReport, finance: getFinanceReport, operations: getOperationsReport } as const;

export async function advancedReportResponse(request: Request, report: AdvancedReport, permission: Permission) {
  const authorization = await authorizeApi(permission); if (!authorization.ok) return authorization.response;
  const parsed = reportQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!parsed.success) return NextResponse.json({ error: "Invalid report filters.", details: parsed.error.flatten() }, { status: 400 });
  const range = resolveReportRange(parsed.data);
  const result = report === "finance" ? await getFinanceReport(range, parsed.data) : await handlers[report](range);
  return NextResponse.json(result);
}
