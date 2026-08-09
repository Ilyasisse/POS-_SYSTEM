import { PERMISSIONS } from "@/lib/auth/permissions";
import { advancedReportResponse } from "@/lib/reports/advanced-api";
export const dynamic = "force-dynamic";
export const GET = (request: Request) => advancedReportResponse(request, "customers", PERMISSIONS.REPORT_CUSTOMER_VIEW);
