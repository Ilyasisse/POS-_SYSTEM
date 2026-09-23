import Link from "next/link";
import { AdminPage, Card } from "@/components/admin/shared";
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
import { requirePermission } from "@/lib/auth/require-permission";
import { reportPermissions } from "@/lib/reports/report-permissions";
import { formatBusinessDate } from "@/lib/reports/reporting-calendar";
import { resolveReportRange } from "@/lib/reports/resolve-range";
import { getSalesReport } from "@/lib/reports/services/sales-report-service";
import { reportQuerySchema } from "@/lib/reports/validation";
import { rankWaiterSales } from "@/lib/reports/waiter-sales";

export const dynamic = "force-dynamic";

export default async function WaiterSalesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission(reportPermissions.daily);
  const raw = (await searchParams) ?? {};
  const normalized = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );
  const query = reportQuerySchema.parse({ preset: "last7Days", ...normalized });
  const range = resolveReportRange(query);
  const report = await getSalesReport(range, query);
  const rows = rankWaiterSales(report.orders);

  return (
    <AdminPage
      title="Waiter sales"
      description="Compare paid order activity by assigned waiter."
    >
      <Button variant="outline" asChild>
        <Link href="/admin/reports">Back to reports</Link>
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
      <Card className="p-5">
        <h2 className="mb-2 text-lg font-black">Paid orders by waiter</h2>
        <p className="mb-4 text-sm text-slate-600">
          Gross order value sums completed order totals. Refunds and discounts
          are not allocated to individual waiters. Unassigned orders are grouped
          separately.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Waiter</TableHead>
              <TableHead className="text-right">Paid orders</TableHead>
              <TableHead className="text-right">Gross order value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="text-right">{row.orders}</TableCell>
                  <TableCell className="text-right">
                    ${row.grossOrderValue}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="py-8 text-center text-slate-500"
                >
                  No paid orders in this period.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </AdminPage>
  );
}
