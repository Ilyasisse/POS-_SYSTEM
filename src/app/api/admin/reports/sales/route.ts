import { PERMISSIONS } from "@/lib/auth/permissions";
import { salesReportResponse } from "@/lib/reports/api-sales-report";

export const dynamic = "force-dynamic";
export const GET = (request: Request) =>
  salesReportResponse(request, PERMISSIONS.REPORT_DAILY_VIEW);
