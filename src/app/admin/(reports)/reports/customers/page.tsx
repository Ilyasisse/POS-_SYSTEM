import Link from "next/link";
import { AdminPage, Card, MetricCard } from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { formatBusinessDate } from "@/lib/reports/reporting-calendar";
import { resolveReportRange } from "@/lib/reports/resolve-range";
import { getCustomerReport } from "@/lib/reports/services/advanced-report-service";
import { reportQuerySchema } from "@/lib/reports/validation";

export const dynamic = "force-dynamic";

export default async function CustomerInsightsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission(PERMISSIONS.REPORT_CUSTOMER_VIEW);
  const raw = (await searchParams) ?? {};
  const normalized = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );
  const query = reportQuerySchema.parse({ preset: "last7Days", ...normalized });
  const range = resolveReportRange(query);
  const report = await getCustomerReport(range);

  return (
    <AdminPage
      title="Customer insights"
      description="Customer visits, feedback, and complaints for the selected business dates."
    >
      <Button variant="outline" asChild>
        <Link href="/admin/business-intelligence">
          Back to business intelligence
        </Link>
      </Button>
      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <label>
            <span className="mb-1 block text-sm font-bold">
              From business date
            </span>
            <Input
              type="date"
              name="from"
              defaultValue={query.from ?? formatBusinessDate(range.start)}
              required
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-bold">
              To business date
            </span>
            <Input
              type="date"
              name="to"
              defaultValue={
                query.to ??
                formatBusinessDate(new Date(range.end.getTime() - 1))
              }
              required
            />
          </label>
          <input type="hidden" name="preset" value="custom" />
          <Button type="submit" className="self-end">
            Apply
          </Button>
        </form>
      </Card>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Identified customers"
          value={report.identifiedCustomers}
        />
        <MetricCard
          label="Repeat customers"
          value={report.repeatCustomers}
          helper="More than one paid order in this period"
        />
        <MetricCard
          label="Identified order value"
          value={`$${report.lifetimeSpendInPeriod}`}
          helper="Paid orders linked to customer profiles"
        />
        <MetricCard
          label="Average rating"
          value={
            report.averageRating == null ? "—" : report.averageRating.toFixed(1)
          }
          helper={`${report.ratings} rated feedback entries`}
        />
      </section>
      <Card className="p-5">
        <h2 className="mb-4 text-lg font-black">Complaint status</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Cases</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.complaints.length ? (
              report.complaints.map((row) => (
                <TableRow key={row.status}>
                  <TableCell>{row.status}</TableCell>
                  <TableCell className="text-right">{row.count}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={2}
                  className="py-8 text-center text-slate-500"
                >
                  No complaints opened in this period.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      <p className="text-sm text-slate-600">
        Visit and spending figures cover identified paid orders only. Ratings
        and complaints use their creation dates; anonymous sales are not
        attributed to customers.
      </p>
    </AdminPage>
  );
}
