import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/api-authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { getExportData, flattenReport, toCsv, toPdf, toPrintHtml, toXlsx, type ExportFormat, type ExportReport } from "@/lib/reports/export-service";
import { resolveReportRange } from "@/lib/reports/resolve-range";
import { reportQuerySchema } from "@/lib/reports/validation";

const reports = new Set<ExportReport>(["sales", "inventory", "staff", "kitchen", "customers", "suppliers", "finance", "operations"]);
const formats = new Set<ExportFormat>(["csv", "xlsx", "pdf", "print"]);
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const authorization = await authorizeApi(PERMISSIONS.REPORT_EXPORT); if (!authorization.ok) return authorization.response;
  const url = new URL(request.url); const report = url.searchParams.get("report"); const format = url.searchParams.get("format");
  if (!report || !formats.has(format as ExportFormat) || !reports.has(report as ExportReport)) return NextResponse.json({ error: "report and format=csv|xlsx|pdf|print are required." }, { status: 400 });
  const parsed = reportQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries())); if (!parsed.success) return NextResponse.json({ error: "Invalid report filters.", details: parsed.error.flatten() }, { status: 400 });
  const data = await getExportData(report as ExportReport, resolveReportRange(parsed.data), parsed.data); const rows = flattenReport(data); const selectedFormat = format as ExportFormat;
  await prisma.reportExportAudit.create({ data: { actorUserId: authorization.user.id, report, format: selectedFormat, filters: parsed.data } });
  if (selectedFormat === "print") return new NextResponse(toPrintHtml(`${report} report`, rows), { headers: { "Content-Type": "text/html; charset=utf-8" } });
  if (selectedFormat === "xlsx") { const file = await toXlsx(`${report} report`, rows); return new NextResponse(new Uint8Array(file), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename=${report}-report.xlsx` } }); }
  if (selectedFormat === "pdf") { const file = await toPdf(`${report} report`, rows); return new NextResponse(new Uint8Array(file), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename=${report}-report.pdf` } }); }
  const csv = toCsv(rows);
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename=${report}-report.csv` } });
}
