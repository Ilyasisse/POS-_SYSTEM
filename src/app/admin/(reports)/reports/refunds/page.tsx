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
import { requirePermission } from "@/lib/auth/require-permission";
import { reportPermissions } from "@/lib/reports/report-permissions";
import { formatBusinessDate } from "@/lib/reports/reporting-calendar";
import { resolveReportRange } from "@/lib/reports/resolve-range";
import { getRefundInsights } from "@/lib/reports/services/refund-insights-service";
import { reportQuerySchema } from "@/lib/reports/validation";

export const dynamic = "force-dynamic";

export default async function RefundInsightsPage({
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
  const report = await getRefundInsights(range);

  return (
    <AdminPage
      title="Refund insights"
      description="Track refund adjustments by their actual refund date."
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
        <p className="mt-3 text-xs text-slate-500">
          Uses when each refund was recorded, which may be later than its order
          date. Includes refunds on paid orders only.
        </p>
      </Card>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Refund adjustments"
          value={report.totalAdjustments}
        />
        <MetricCard
          label="Whole-order or unlinked refunds"
          value={report.unallocatedAdjustments}
        />
        <MetricCard
          label="Unallocated refund value"
          value={`$${report.unallocatedAmount}`}
        />
      </section>
      <Card className="p-5">
        <h2 className="mb-2 text-lg font-black">
          Products with item-linked refunds
        </h2>
        <p className="mb-4 text-sm text-slate-600">
          A product counts once per refunded order, even if it has multiple
          refund adjustments. Whole-order refunds are not guessed across
          products.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Refunded orders</TableHead>
              <TableHead className="text-right">Adjustments</TableHead>
              <TableHead className="text-right">Refund value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.products.length ? (
              report.products.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="text-right">
                    {row.refundedOrders}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.adjustments}
                  </TableCell>
                  <TableCell className="text-right">${row.amount}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-8 text-center text-slate-500"
                >
                  No item-linked refunds in this period.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </AdminPage>
  );
}
