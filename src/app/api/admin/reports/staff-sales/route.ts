import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/api-authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  isReportSchemaNotReady,
  REPORT_SCHEMA_NOT_READY_MESSAGE,
} from "@/lib/reports/report-errors";
import { resolveReportRange } from "@/lib/reports/resolve-range";
import { getStaffSalesReport } from "@/lib/reports/services/staff-sales-report-service";
import { reportQuerySchema } from "@/lib/reports/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorization = await authorizeApi(PERMISSIONS.REPORT_STAFF_VIEW);
  if (!authorization.ok) return authorization.response;

  const parsed = reportQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid report filters.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      await getStaffSalesReport(resolveReportRange(parsed.data), parsed.data),
    );
  } catch (error) {
    if (!isReportSchemaNotReady(error)) throw error;
    return NextResponse.json(
      {
        error: REPORT_SCHEMA_NOT_READY_MESSAGE,
        code: "REPORT_SCHEMA_NOT_READY",
        requiredMigrations: [
          "20260718_reporting_foundation",
          "20260718_sales_integrity",
        ],
      },
      { status: 503 },
    );
  }
}
