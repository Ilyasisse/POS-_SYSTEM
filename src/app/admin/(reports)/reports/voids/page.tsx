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
import { getVoidInsights } from "@/lib/reports/services/void-insights-service";
import { reportQuerySchema } from "@/lib/reports/validation";

export const dynamic = "force-dynamic";

export default async function VoidInsightsPage({
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
  const insights = await getVoidInsights(range);

  return (
    <AdminPage
      title="Voided orders"
      description="Find products on voided orders and review the recorded reasons."
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
          Orders voided in the selected business date range. Only orders with a
          recorded VOID adjustment are included.
        </p>
      </Card>
      <section className="max-w-xs">
        <MetricCard label="Voided orders" value={insights.totalOrders} />
      </section>
      <Card className="p-5">
        <h2 className="mb-2 text-lg font-black">Products on voided orders</h2>
        <p className="mb-4 text-sm text-slate-600">
          Counts whole orders containing each product; repeat lines in one order
          count once. Quantities include all lines. These are not item-level
          voids or lost-sales amounts.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Orders</TableHead>
              <TableHead className="text-right">Units</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {insights.products.length ? (
              insights.products.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="text-right">{row.orders}</TableCell>
                  <TableCell className="text-right">{row.quantity}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="py-8 text-center text-slate-500"
                >
                  No voided products in this period.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      <Card className="p-5">
        <h2 className="mb-4 text-lg font-black">Recorded reasons</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reason</TableHead>
              <TableHead className="text-right">Voids</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {insights.reasons.length ? (
              insights.reasons.map((row) => (
                <TableRow key={row.reason}>
                  <TableCell className="max-w-xl break-words">
                    {row.reason}
                  </TableCell>
                  <TableCell className="text-right">{row.count}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={2}
                  className="py-8 text-center text-slate-500"
                >
                  No recorded reasons in this period.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </AdminPage>
  );
}
