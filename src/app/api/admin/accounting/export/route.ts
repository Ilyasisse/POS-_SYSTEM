import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/api-authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getAccountingJournal } from "@/lib/accounting/accounting-journal-service";
import { toAccountingJournalCsv } from "@/lib/accounting/accounting-journal-domain";
import { prisma } from "@/lib/prisma";
import { resolveReportRange } from "@/lib/reports/resolve-range";
import { reportQuerySchema } from "@/lib/reports/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorization = await authorizeApi(PERMISSIONS.REPORT_FINANCIAL_VIEW);
  if (!authorization.ok) return authorization.response;

  const url = new URL(request.url);
  const parsed = reportQuerySchema.safeParse({
    preset: "custom",
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  if (!parsed.success || !parsed.data.from || !parsed.data.to) {
    return NextResponse.json({ error: "Valid from and to dates are required." }, { status: 400 });
  }

  const journal = await getAccountingJournal({
    activityRange: resolveReportRange(parsed.data),
    fromDate: parsed.data.from,
    toDate: parsed.data.to,
  });
  await prisma.reportExportAudit.create({
    data: {
      actorUserId: authorization.user.id,
      report: "accounting-journal",
      format: "csv",
      filters: { from: parsed.data.from, to: parsed.data.to },
    },
  });

  return new NextResponse(toAccountingJournalCsv(journal.rows, journal.currencyCode), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="accounting-journal-${parsed.data.from}-to-${parsed.data.to}.csv"`,
    },
  });
}
