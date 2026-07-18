import Link from "next/link";
import { AdminPage, Card, MetricCard } from "@/components/admin/shared";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PERMISSIONS, type Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { resolveReportRange } from "@/lib/reports/resolve-range";
import { getSalesReport } from "@/lib/reports/services/sales-report-service";
import { reportQuerySchema } from "@/lib/reports/validation";
import {
  isReportSchemaNotReady,
  REPORT_SCHEMA_NOT_READY_MESSAGE,
} from "@/lib/reports/report-errors";

type SearchParams = Record<string, string | string[] | undefined>;
type Props = {
  title: string;
  description: string;
  defaultPreset: "currentBusinessDay" | "thisWeek" | "thisMonth";
  permission: Permission;
  searchParams?: Promise<SearchParams>;
  focus?: "overview" | "products" | "orders";
};

const money = (value: string | null) => (value == null ? "Unavailable" : `$${value}`);
const links = [
  ["Daily", "/admin/reports/daily"],
  ["Weekly", "/admin/reports/weekly"],
  ["Monthly", "/admin/reports/monthly"],
  ["Sales", "/admin/reports/sales"],
  ["Products", "/admin/reports/products"],
] as const;

export async function SalesReportPage({
  title,
  description,
  defaultPreset,
  permission,
  searchParams,
  focus = "overview",
}: Props) {
  const user = await requirePermission(permission);
  const raw = (await searchParams) ?? {};
  const normalized = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  const parsed = reportQuerySchema.parse({ ...normalized, preset: normalized.preset ?? defaultPreset });
  let report: Awaited<ReturnType<typeof getSalesReport>>;
  try {
    report = await getSalesReport(resolveReportRange(parsed), parsed);
  } catch (error) {
    if (!isReportSchemaNotReady(error)) throw error;
    return (
      <AdminPage title={title} description={description}>
        <Alert variant="destructive">
          <AlertTitle>Reporting database migration required</AlertTitle>
          <AlertDescription>
            {REPORT_SCHEMA_NOT_READY_MESSAGE} Required migrations:
            <code className="mt-2 block text-xs">
              20260718_reporting_foundation, 20260718_sales_integrity
            </code>
          </AlertDescription>
        </Alert>
      </AdminPage>
    );
  }
  const canSeeFinancials = user.role === "ADMIN";
  const rows = focus === "products" ? report.products : report.categories;

  return (
    <AdminPage title={title} description={description}>
      <nav className="flex flex-wrap gap-2" aria-label="Report sections">
        {links.map(([label, href]) => (
          <Button key={href} variant="outline" asChild><Link href={href}>{label}</Link></Button>
        ))}
      </nav>

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <label><span className="mb-1 block text-sm font-bold">From business date</span><Input type="date" name="from" defaultValue={parsed.from} /></label>
          <label><span className="mb-1 block text-sm font-bold">To business date</span><Input type="date" name="to" defaultValue={parsed.to} /></label>
          <input type="hidden" name="preset" value="custom" />
          <Button type="submit" className="self-end">Apply</Button>
        </form>
        <p className="mt-3 text-xs text-slate-500">
          {new Date(report.period.start).toLocaleString("en-US", { timeZone: report.period.timezone })} – {new Date(report.period.end).toLocaleString("en-US", { timeZone: report.period.timezone })}
        </p>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Net Sales" value={money(report.summary.netSales)} />
        <MetricCard label="Paid Orders" value={report.summary.paidOrders} />
        <MetricCard label="Average Order Value" value={money(report.summary.averageOrderValue)} />
        <MetricCard label="Open / Unpaid" value={report.summary.unpaidOrders} />
        <MetricCard label="Discounts" value={money(report.summary.discounts)} />
        <MetricCard label="Refunds" value={money(report.summary.refunds)} />
        <MetricCard label="Voided Orders" value={report.summary.voidedOrders} />
        {canSeeFinancials ? <MetricCard label="Estimated Gross Profit" value={money(report.summary.grossProfit)} helper={`Cost coverage ${report.summary.costCoveragePercent ?? "0.00"}%`} /> : null}
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-lg font-black">Mobile-money sales</h2>
          <div className="mt-4 space-y-3">
            {report.paymentMethods.length === 0 ? <p className="text-sm text-slate-500">No paid orders in this period.</p> : report.paymentMethods.map((item) => (
              <div key={item.method} className="flex justify-between"><Badge variant="outline">{item.method}</Badge><strong>{money(item.amount)}</strong></div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="text-lg font-black">Data coverage</h2>
          <p className="mt-3 text-sm text-slate-600">{report.summary.costCoveredLines} of {report.summary.totalLines} sold lines have a historical cost snapshot. Profit remains unavailable until coverage is complete.</p>
          <p className="mt-2 text-sm text-slate-600">Cash and card are not shown because the POS currently captures mobile-money providers only.</p>
        </Card>
      </section>

      <Card className="p-5">
        <h2 className="mb-4 text-lg font-black">{focus === "products" ? "Product performance" : "Category performance"}</h2>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead className="text-right">Gross sales</TableHead>{canSeeFinancials ? <TableHead className="text-right">Gross profit</TableHead> : null}</TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 ? <TableRow><TableCell colSpan={canSeeFinancials ? 4 : 3} className="py-8 text-center text-slate-500">No sales found for this period.</TableCell></TableRow> : rows.map((row) => (
              <TableRow key={row.id}><TableCell className="font-bold">{row.name}</TableCell><TableCell className="text-right">{row.quantity}</TableCell><TableCell className="text-right">{money(row.grossSales)}</TableCell>{canSeeFinancials ? <TableCell className="text-right">{money(row.grossProfit)}</TableCell> : null}</TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {focus === "orders" ? (
        <Card className="p-5"><h2 className="mb-4 text-lg font-black">Paid orders</h2><Table><TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Closed</TableHead><TableHead>Waiter</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader><TableBody>{report.orders.map((order) => <TableRow key={order.id}><TableCell>#{order.orderNumber}</TableCell><TableCell>{order.closedAt ? new Date(order.closedAt).toLocaleString() : "—"}</TableCell><TableCell>{order.waiter ?? "—"}</TableCell><TableCell className="text-right">{money(order.total)}</TableCell></TableRow>)}</TableBody></Table></Card>
      ) : null}
      <p className="text-xs text-slate-500">Recognized revenue uses fully paid orders and their closed time. Archived products remain visible through order-line snapshot names.</p>
    </AdminPage>
  );
}

export const reportPermissions = {
  daily: PERMISSIONS.REPORT_DAILY_VIEW,
  weekly: PERMISSIONS.REPORT_WEEKLY_VIEW,
  monthly: PERMISSIONS.REPORT_MONTHLY_VIEW,
} as const;
