import Link from "next/link";
import { AdminPage, Card } from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/require-permission";
import { reportPermissions } from "@/lib/reports/report-permissions";
import { compareSalesSummaries, comparisonMonthRange, comparisonMonthSchema, defaultComparisonMonths } from "@/lib/reports/sales-comparison";
import { getSalesReport } from "@/lib/reports/services/sales-report-service";
import { reportQuerySchema } from "@/lib/reports/validation";
import { isReportSchemaNotReady, REPORT_SCHEMA_NOT_READY_MESSAGE } from "@/lib/reports/report-errors";

export const dynamic = "force-dynamic";
type Params = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const display = (value: string | null, money: boolean) => value == null ? "Unavailable" : `${money ? "$" : ""}${value}`;

export default async function Page({ searchParams }: { searchParams?: Promise<Params> }) {
  await requirePermission(reportPermissions.monthly);
  const raw = (await searchParams) ?? {};
  const now = new Date();
  const defaults = defaultComparisonMonths(now);
  const month = first(raw.month) ?? defaults.month;
  const baseline = first(raw.baseline) ?? defaults.baseline;
  const valid = comparisonMonthSchema.safeParse(month).success && comparisonMonthSchema.safeParse(baseline).success;
  let rows: ReturnType<typeof compareSalesSummaries> | null = null;
  let error: string | null = valid ? null : "Choose valid months between January 2000 and December 2099.";
  let incomplete = false;
  if (valid) {
    const currentRange = comparisonMonthRange(month);
    const baselineRange = comparisonMonthRange(baseline);
    incomplete = currentRange.end.getTime() > now.getTime() || baselineRange.end.getTime() > now.getTime();
    try {
      const query = reportQuerySchema.parse({});
      const [current, previous] = await Promise.all([
        getSalesReport(currentRange, query), getSalesReport(baselineRange, query),
      ]);
      rows = compareSalesSummaries(current.summary, previous.summary);
    } catch (cause) {
      if (!isReportSchemaNotReady(cause)) throw cause;
      error = REPORT_SCHEMA_NOT_READY_MESSAGE;
    }
  }
  return (
    <AdminPage title="Monthly sales comparison" description="Compare completed months to understand changes in café sales.">
      <Button variant="outline" asChild><Link href="/admin/reports/monthly">Monthly sales</Link></Button>
      <Card className="p-5">
        <form className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
          <label><span className="mb-1 block text-sm font-bold">Month to review</span><Input type="month" name="month" required min="2000-01" max="2099-12" defaultValue={month} /></label>
          <label><span className="mb-1 block text-sm font-bold">Compare with</span><Input type="month" name="baseline" required min="2000-01" max="2099-12" defaultValue={baseline} /></label>
          <Button type="submit" className="self-end">Compare</Button>
        </form>
        {error ? <p className="mt-3 text-sm text-red-700" role="alert">{error}</p> : null}
      </Card>
      {incomplete ? <Alert><AlertTitle>Incomplete month selected</AlertTitle><AlertDescription>These totals include sales recorded so far. Comparing an unfinished month with a complete month can be misleading.</AlertDescription></Alert> : null}
      {rows ? <Card className="p-5">
        <Table>
          <TableHeader><TableRow><TableHead>Metric</TableHead><TableHead className="text-right">{month}</TableHead><TableHead className="text-right">{baseline}</TableHead><TableHead className="text-right">Change</TableHead><TableHead className="text-right">Change %</TableHead></TableRow></TableHeader>
          <TableBody>{rows.map((row) => <TableRow key={row.label}>
            <TableCell className="font-bold">{row.label}</TableCell>
            <TableCell className="text-right">{display(row.value, row.money)}</TableCell>
            <TableCell className="text-right">{display(row.baseline, row.money)}</TableCell>
            <TableCell className="text-right">{display(row.delta, row.money)}</TableCell>
            <TableCell className="text-right">{row.percent == null ? "Unavailable" : `${row.percent}%`}</TableCell>
          </TableRow>)}</TableBody>
        </Table>
        <p className="mt-4 text-xs text-slate-500">Months run from the first day at 7 AM to the next month at 7 AM in café time (UTC+3). Revenue uses fully paid orders and the same reductions as monthly sales. Months may contain different numbers of trading days. Percentage change is unavailable when the comparison value is zero, negative, or missing.</p>
      </Card> : null}
    </AdminPage>
  );
}
