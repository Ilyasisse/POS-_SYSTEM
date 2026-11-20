import Link from "next/link";
import {
  AdminPage,
  Button,
  DataTableCard,
  Table,
  TableCell,
  TableHead,
} from "@/components/admin/shared";
import { formatMoney } from "@/lib/admin/helper/formatMoney";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { formatSupplierInvoiceNumber } from "@/lib/suppliers/invoice-number";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default async function SupplierPriceHistoryPage({
  searchParams,
}: {
  searchParams?: Promise<{
    supplier?: string;
    catalog?: string;
    page?: string;
  }>;
}) {
  await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const query = (await searchParams) ?? {};
  const suppliers = await prisma.supplier.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const supplierId = suppliers.some(
    (supplier) => supplier.id === query.supplier,
  )
    ? query.supplier
    : undefined;
  const catalogs = supplierId
    ? await prisma.supplierCatalogItem.findMany({
        where: { supplierId },
        select: {
          id: true,
          unit: true,
          product: { select: { name: true } },
          inventorySupply: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const catalogId = catalogs.some((catalog) => catalog.id === query.catalog)
    ? query.catalog
    : undefined;
  const requestedPage =
    query.page && /^[1-9]\d{0,3}$/.test(query.page) ? Number(query.page) : 1;
  const where = {
    invoice: { supplierId: supplierId!, status: "FINALIZED" as const },
    supplierCatalogItemId: catalogId,
  };
  const count = supplierId
    ? await prisma.supplierInvoiceItem.count({ where })
    : 0;
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const items = supplierId
    ? await prisma.supplierInvoiceItem.findMany({
        where,
        include: {
          invoice: {
            select: { id: true, invoiceDate: true, invoiceNumber: true },
          },
        },
        orderBy: [
          { invoice: { invoiceDate: "desc" } },
          { createdAt: "desc" },
          { id: "desc" },
        ],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      })
    : [];
  const hrefForPage = (next: number) => {
    const params = new URLSearchParams({
      supplier: supplierId!,
      page: String(next),
    });
    if (catalogId) params.set("catalog", catalogId);
    return `/admin/supplier-price-history?${params.toString()}`;
  };

  return (
    <AdminPage
      title="Supplier purchase price history"
      description="Compare unit prices recorded on finalized supplier invoices. Draft and void invoices are excluded."
      action={
        <Button asChild variant="outline">
          <Link href="/admin/supplier-invoices">Supplier invoices</Link>
        </Button>
      }
    >
      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border bg-background p-4"
      >
        <label className="grid gap-1 text-sm font-semibold">
          Supplier
          <select
            name="supplier"
            defaultValue={supplierId ?? ""}
            className="h-10 min-w-48 rounded-md border bg-background px-3"
          >
            <option value="">Choose a supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Catalog item
          <select
            name="catalog"
            defaultValue={catalogId ?? ""}
            disabled={!supplierId}
            className="h-10 min-w-48 rounded-md border bg-background px-3"
          >
            <option value="">All items</option>
            {catalogs.map((catalog) => (
              <option key={catalog.id} value={catalog.id}>
                {catalog.product?.name ??
                  catalog.inventorySupply?.name ??
                  "Unnamed item"}{" "}
                ({catalog.unit})
              </option>
            ))}
          </select>
        </label>
        <Button type="submit">Show prices</Button>
      </form>
      {!supplierId ? (
        <p className="rounded-xl border bg-background p-6 text-sm">
          Choose a supplier to review invoice price history.
        </p>
      ) : (
        <DataTableCard>
          <div className="space-y-1 px-4 py-3">
            <h2 className="font-semibold">Finalized invoice line prices</h2>
            <p className="text-sm text-muted-foreground">
              {count} line{count === 1 ? "" : "s"} found. Prices are invoice
              snapshots and do not change the current catalog.
            </p>
          </div>
          <Table>
            <thead>
              <tr>
                <TableHead>Date</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Unit price</TableHead>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t">
                  <TableCell>
                    {dateFormatter.format(item.invoice.invoiceDate)}
                  </TableCell>
                  <TableCell>
                    <Link
                      className="underline"
                      href={`/admin/supplier-invoices/${item.invoice.id}`}
                    >
                      {formatSupplierInvoiceNumber(item.invoice.invoiceNumber)}
                    </Link>
                  </TableCell>
                  <TableCell>{item.itemName}</TableCell>
                  <TableCell>{item.itemUnit}</TableCell>
                  <TableCell>{item.quantity.toString()}</TableCell>
                  <TableCell className="font-semibold">
                    {formatMoney(Number(item.unitPrice))}
                  </TableCell>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <TableCell colSpan={6}>
                    No finalized invoice lines for this selection.
                  </TableCell>
                </tr>
              ) : null}
            </tbody>
          </Table>
          {totalPages > 1 ? (
            <div className="flex items-center justify-between gap-3 p-4 text-sm">
              {page > 1 ? (
                <Link className="underline" href={hrefForPage(page - 1)}>
                  Previous
                </Link>
              ) : (
                <span />
              )}
              <span>
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <Link className="underline" href={hrefForPage(page + 1)}>
                  Next
                </Link>
              ) : (
                <span />
              )}
            </div>
          ) : null}
        </DataTableCard>
      )}
    </AdminPage>
  );
}
