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
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { canonicalUnitLabel } from "@/lib/inventory/inventory-domain";
import { formatBusinessDate } from "@/lib/reports/reporting-calendar";
import { resolveReportRange } from "@/lib/reports/resolve-range";
import { getInventoryLossReport } from "@/lib/reports/services/inventory-loss-service";
import { reportQuerySchema } from "@/lib/reports/validation";

export const dynamic = "force-dynamic";

export default async function InventoryLossReportPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission(PERMISSIONS.REPORT_INVENTORY_VIEW);
  const canSeeCosts = hasPermission(user, PERMISSIONS.INVENTORY_COST_MANAGE);
  const raw = (await searchParams) ?? {};
  const normalized = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );
  const query = reportQuerySchema.parse({ preset: "last7Days", ...normalized });
  const range = resolveReportRange(query);
  const report = await getInventoryLossReport(range);

  return (
    <AdminPage
      title="Inventory losses"
      description="Review recorded waste, spoilage, and damage by business date."
      action={
        <Button variant="outline" asChild>
          <Link href="/admin/business-intelligence">
            Back to business intelligence
          </Link>
        </Button>
      }
    >
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
          Uses the stock event time, which may differ from the day an item was
          purchased.
        </p>
      </Card>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Loss events" value={report.eventCount} />
        <MetricCard
          label="Events without full cost"
          value={report.missingCostEvents}
        />
        {canSeeCosts ? (
          <MetricCard
            label="Known loss cost"
            value={`$${report.knownCost}`}
            helper={`${report.coveredEvents} of ${report.eventCount} events with complete cost`}
          />
        ) : null}
      </section>
      <Card className="p-5">
        <p className="mb-4 text-sm text-slate-600">
          Quantities stay separate by item, cause, and canonical unit.{" "}
          {canSeeCosts
            ? "Known cost is a partial total when cost coverage is incomplete; it is not an estimate for missing events."
            : "Unit costs are limited to administrators."}
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Cause</TableHead>
              <TableHead className="text-right">Events</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              {canSeeCosts ? (
                <>
                  <TableHead className="text-right">Known cost</TableHead>
                  <TableHead className="text-right">Missing costs</TableHead>
                </>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.rows.length ? (
              report.rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.type.toLowerCase()}</TableCell>
                  <TableCell className="text-right">{row.events}</TableCell>
                  <TableCell className="text-right">
                    {row.quantity} {canonicalUnitLabel(row.unit)}
                  </TableCell>
                  {canSeeCosts ? (
                    <>
                      <TableCell className="text-right">
                        ${row.knownCost}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.events - row.coveredEvents}
                      </TableCell>
                    </>
                  ) : null}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={canSeeCosts ? 6 : 4}
                  className="py-8 text-center text-slate-500"
                >
                  No recorded losses in this period.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </AdminPage>
  );
}
