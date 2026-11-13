import Link from "next/link";
import { AdminPage, Card } from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { reportPermissions } from "@/lib/reports/report-permissions";
import { reportQuerySchema } from "@/lib/reports/validation";
import { resolveReportRange } from "@/lib/reports/resolve-range";
import { formatBusinessDate } from "@/lib/reports/reporting-calendar";
import { unsoldProductsWhere } from "@/lib/reports/unsold-products";

type Params = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const PAGE_SIZE = 50;

export async function UnsoldProductsPage({ searchParams }: { searchParams?: Promise<Params> }) {
  await requirePermission(reportPermissions.daily);
  const raw = (await searchParams) ?? {};
  const defaults = resolveReportRange(reportQuerySchema.parse({ preset: "last7Days" }));
  const from = first(raw.from) ?? formatBusinessDate(defaults.start);
  const to = first(raw.to) ?? formatBusinessDate(new Date(defaults.end.getTime() - 86_400_000));
  const parsed = reportQuerySchema.safeParse({ preset: "custom", from, to, page: first(raw.page) ?? 1 });
  const page = parsed.success ? parsed.data.page : 1;
  const range = parsed.success ? resolveReportRange(parsed.data) : null;
  const products = range ? await prisma.product.findMany({
    where: unsoldProductsWhere(range),
    select: { id: true, name: true, price: true, category: { select: { name: true } } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
  }) : [];
  const hasNext = products.length > PAGE_SIZE;
  const pageLink = (target: number) => `/admin/reports/unsold-products?${new URLSearchParams({ from, to, page: String(target) })}`;
  return (
    <AdminPage title="Products with no sales" description="Review active menu items with no fully paid orders in a selected period.">
      <Button variant="outline" asChild><Link href="/admin/reports/products">Product performance</Link></Button>
      <Card className="p-5">
        <form className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
          <label><span className="mb-1 block text-sm font-bold">From business date</span><Input type="date" name="from" required defaultValue={from} /></label>
          <label><span className="mb-1 block text-sm font-bold">To business date</span><Input type="date" name="to" required defaultValue={to} /></label>
          <Button type="submit" className="self-end">Apply</Button>
        </form>
        {!parsed.success ? <p role="alert" className="mt-3 text-sm text-red-700">Enter valid dates with the start on or before the end, and a positive page number.</p> : null}
      </Card>
      {range ? <Card className="p-5">
        <p className="mb-4 text-sm text-slate-600">Only currently active products in active categories, created before this period began, are included. Open and cancelled orders do not count as paid sales. A refunded paid order still counts as a sale.</p>
        <Table>
          <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Current price</TableHead></TableRow></TableHeader>
          <TableBody>{products.length === 0 ? <TableRow><TableCell colSpan={3} className="py-8 text-center">No products with no paid sales on this page.</TableCell></TableRow> : products.slice(0, PAGE_SIZE).map((product) => <TableRow key={product.id}><TableCell className="font-bold">{product.name}</TableCell><TableCell>{product.category.name}</TableCell><TableCell className="text-right">${product.price.toFixed(2)}</TableCell></TableRow>)}</TableBody>
        </Table>
        <nav aria-label="Report pages" className="mt-4 flex items-center gap-3">
          {page > 1 ? <Button variant="outline" asChild><Link href={pageLink(page - 1)}>Previous</Link></Button> : null}
          <span className="text-sm">Page {page}</span>
          {hasNext ? <Button variant="outline" asChild><Link href={pageLink(page + 1)}>Next</Link></Button> : null}
        </nav>
        <p className="mt-4 text-xs text-slate-500">Dates use café business time (UTC+3), from 7 AM on the first date through 5 AM after the last date. Zero sales may reflect stockouts, menu visibility, or an unfinished period; review availability before removing an item.</p>
      </Card> : null}
    </AdminPage>
  );
}
