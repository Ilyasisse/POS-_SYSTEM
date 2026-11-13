import Link from "next/link";
import { AdminPage, Card } from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import {
  classifyMenuProducts,
  type MenuClass,
} from "@/lib/reports/menu-engineering";
import { getSalesReport } from "@/lib/reports/services/sales-report-service";
import { resolveReportRange } from "@/lib/reports/resolve-range";
import { formatBusinessDate } from "@/lib/reports/reporting-calendar";
import {
  isReportSchemaNotReady,
  REPORT_SCHEMA_NOT_READY_MESSAGE,
} from "@/lib/reports/report-errors";
import { reportQuerySchema } from "@/lib/reports/validation";

export const dynamic = "force-dynamic";
const categories: { name: MenuClass; description: string }[] = [
  {
    name: "Star",
    description: "Popular with above-average gross profit per item.",
  },
  {
    name: "Puzzle",
    description: "Less popular with above-average gross profit per item.",
  },
  {
    name: "Workhorse",
    description: "Popular with below-average gross profit per item.",
  },
  {
    name: "Review",
    description: "Less popular with below-average gross profit per item.",
  },
];

export default async function MenuEngineeringPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission(PERMISSIONS.REPORT_FINANCIAL_VIEW);
  const raw = (await searchParams) ?? {};
  const normalized = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );
  const query = reportQuerySchema.parse({
    ...normalized,
    preset: normalized.preset ?? "thisMonth",
  });
  const range = resolveReportRange(query);
  let report: Awaited<ReturnType<typeof getSalesReport>>;
  try {
    report = await getSalesReport(range, query);
  } catch (error) {
    if (!isReportSchemaNotReady(error)) throw error;
    return (
      <AdminPage
        title="Menu engineering"
        description="Compare product sales and estimated unit profit."
      >
        <Alert variant="destructive">
          <AlertTitle>Reporting database migration required</AlertTitle>
          <AlertDescription>{REPORT_SCHEMA_NOT_READY_MESSAGE}</AlertDescription>
        </Alert>
      </AdminPage>
    );
  }
  const matrix = classifyMenuProducts(report.products);

  return (
    <AdminPage
      title="Menu engineering"
      description="Compare sold quantity and estimated gross profit per item for paid orders."
    >
      <Button asChild variant="outline">
        <Link href="/admin/reports/products">Back to product performance</Link>
      </Button>
      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <label>
            <span className="mb-1 block text-sm font-bold">
              From business date
            </span>
            <Input
              name="from"
              type="date"
              defaultValue={query.from ?? formatBusinessDate(range.start)}
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-bold">
              To business date
            </span>
            <Input
              name="to"
              type="date"
              defaultValue={
                query.to ??
                formatBusinessDate(new Date(range.end.getTime() - 86_400_000))
              }
            />
          </label>
          <input type="hidden" name="preset" value="custom" />
          <Button type="submit" className="self-end">
            Apply
          </Button>
        </form>
        <p className="mt-3 text-sm text-muted-foreground">
          Café time:{" "}
          {new Date(report.period.start).toLocaleDateString("en-US", {
            timeZone: report.period.timezone,
          })}{" "}
          –{" "}
          {new Date(report.period.end).toLocaleDateString("en-US", {
            timeZone: report.period.timezone,
          })}
          . Popular means at least {matrix.popularityAverage.toFixed(1)} items
          sold. High unit profit means at least $
          {matrix.unitProfitAverage.toFixed(2)}.
        </p>
        <p className="mt-2 text-sm text-amber-800">
          {matrix.excluded} sold product(s) excluded because historical cost is
          missing. Gross profit is an estimate before discounts, refunds, and
          other adjustments; modifier costs may be incomplete.
        </p>
      </Card>
      {matrix.rows.length === 0 ? (
        <Card className="p-6">
          No sold products with complete cost snapshots in this period.
        </Card>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {categories.map(({ name, description }) => {
            const rows = matrix.rows.filter((row) => row.category === name);
            return (
              <Card key={name} className="p-5">
                <h2 className="text-xl font-bold">
                  {name} · {rows.length}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {description}
                </p>
                {rows.length ? (
                  <ul className="mt-4 space-y-2">
                    {rows.map((row) => (
                      <li
                        key={row.id}
                        className="flex justify-between gap-3 border-t pt-2 text-sm"
                      >
                        <span>
                          {row.name} · {row.quantity} sold
                        </span>
                        <strong className="whitespace-nowrap">
                          ${row.unitProfit.toFixed(2)} / item
                        </strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">
                    No products in this group.
                  </p>
                )}
              </Card>
            );
          })}
        </section>
      )}
    </AdminPage>
  );
}
