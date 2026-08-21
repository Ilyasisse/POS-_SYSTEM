import { PERMISSIONS } from "@/lib/auth/permissions";
import { advancedReportResponse } from "@/lib/reports/advanced-api";
export const dynamic = "force-dynamic";
export const GET = (request: Request) => advancedReportResponse(request, "suppliers", PERMISSIONS.REPORT_SUPPLIER_VIEW);
