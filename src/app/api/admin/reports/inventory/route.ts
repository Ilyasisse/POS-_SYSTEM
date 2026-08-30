import { PERMISSIONS } from "@/lib/auth/permissions";
import { advancedReportResponse } from "@/lib/reports/advanced-api";
export const dynamic = "force-dynamic";
export const GET = (request: Request) => advancedReportResponse(request, "inventory", PERMISSIONS.REPORT_INVENTORY_VIEW);
