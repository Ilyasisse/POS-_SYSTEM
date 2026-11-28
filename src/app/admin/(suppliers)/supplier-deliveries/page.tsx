import Link from "next/link";
import { Prisma } from "@prisma/client";
import {
  AdminPage,
  Button,
  Card,
  DataTableCard,
  Table,
  TableCell,
  TableHead,
} from "@/components/admin/shared";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import {
  getDefaultDeliveryDates,
  getDeliveryDateBounds,
  summarizeDeliveryLines,
} from "@/lib/suppliers/delivery-report";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;
const time = new Intl.DateTimeFormat("en-US", {
  timeZone: "Africa/Nairobi",
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function SupplierDeliveriesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    from?: string;
    to?: string;
    supplier?: string;
    page?: string;
  }>;
}) {
  await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const query = (await searchParams) ?? {};
  const defaults = getDefaultDeliveryDates();
  const from = query.from ?? defaults.from;
  const to = query.to ?? defaults.to;
  const range = getDeliveryDateBounds(from, to);
  const suppliers = await prisma.supplier.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const supplier = suppliers.some(
    (candidate) => candidate.id === query.supplier,
  )
    ? query.supplier
    : "";
  const invalidSupplier = Boolean(query.supplier && !supplier);
  const where: Prisma.SupplierReceivingWhereInput = {
    receivedAt: range ? { gte: range.start, lt: range.end } : undefined,
    purchaseOrder: supplier ? { supplierId: supplier } : undefined,
  };
  const total =
    range && !invalidSupplier
      ? await prisma.supplierReceiving.count({ where })
      : 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const requested = Number(query.page);
  const page =
    Number.isSafeInteger(requested) && requested >= 1
      ? Math.min(requested, pages)
      : 1;
  const deliveries =
    range && !invalidSupplier
      ? await prisma.supplierReceiving.findMany({
          where,
          select: {
            id: true,
            receivedAt: true,
            qualityRating: true,
            completionNote: true,
            purchaseOrder: {
              select: {
                id: true,
                orderNumber: true,
                supplier: { select: { name: true } },
              },
            },
            receivedBy: { select: { fullName: true } },
            items: {
              select: {
                expectedQuantity: true,
                receivedQuantity: true,
                purchaseOrderItem: {
                  select: { id: true, itemName: true, itemUnit: true },
                },
              },
            },
          },
          orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        })
      : [];

  function pageHref(target: number) {
    const params = new URLSearchParams({ from, to, page: String(target) });
    if (supplier) params.set("supplier", supplier);
    return `/admin/supplier-deliveries?${params.toString()}`;
  }

  return (
    <AdminPage
      title="Supplier delivery review"
      description="Compare recorded delivery quantities against the original purchase order, including shortages and extras."
      action={
        <Button asChild variant="outline">
          <Link href="/admin/supplier-purchase-orders">Purchase orders</Link>
        </Button>
      }
    >
      <form
        method="get"
        className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-4 sm:items-end"
      >
        <label className="text-sm">
          From (café date)
          <input
            name="from"
            type="date"
            required
            defaultValue={from}
            className="mt-1 block w-full rounded border px-3 py-2"
          />
        </label>
        <label className="text-sm">
          To (café date)
          <input
            name="to"
            type="date"
            required
            defaultValue={to}
            className="mt-1 block w-full rounded border px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Supplier
          <select
            name="supplier"
            defaultValue={supplier}
            className="mt-1 block w-full rounded border px-3 py-2"
          >
            <option value="">All suppliers</option>
            {suppliers.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit">Apply filters</Button>
      </form>
      {!range || invalidSupplier ? (
        <Card className="border-amber-300 p-4 text-sm">
          {invalidSupplier
            ? "That supplier is unavailable. Choose one from the list."
            : "Choose valid dates, with From no later than To."}
        </Card>
      ) : null}
      <p className="text-sm text-muted-foreground">
        {total} recorded deliveries in the selected dates. Showing page {page}{" "}
        of {pages}, most recent first. An unrecorded delivery cannot appear in
        this report; inventory and invoices are not changed by delivery counts.
      </p>
      <DataTableCard>
        <Table>
          <thead>
            <tr>
              <TableHead>Delivery</TableHead>
              <TableHead>Supplier / PO</TableHead>
              <TableHead>Counted items</TableHead>
              <TableHead>Review</TableHead>
            </tr>
          </thead>
          <tbody>
            {deliveries.length ? (
              deliveries.map((delivery) => {
                const summary = summarizeDeliveryLines(delivery.items);
                return (
                  <tr key={delivery.id} className="border-t align-top">
                    <TableCell>
                      <div>{time.format(delivery.receivedAt)}</div>
                      <div className="text-xs text-muted-foreground">
                        by {delivery.receivedBy.fullName}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{delivery.purchaseOrder.supplier.name}</div>
                      <Link
                        className="text-primary underline"
                        href={`/admin/supplier-purchase-orders/${delivery.purchaseOrder.id}`}
                      >
                        PO #{delivery.purchaseOrder.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {delivery.items.map((item) => {
                        const difference = new Prisma.Decimal(
                          item.receivedQuantity,
                        ).minus(item.expectedQuantity);
                        return (
                          <div key={item.purchaseOrderItem.id}>
                            {item.purchaseOrderItem.itemName}:{" "}
                            {item.receivedQuantity.toString()} /{" "}
                            {item.expectedQuantity.toString()}{" "}
                            {item.purchaseOrderItem.itemUnit}
                            {difference.isZero() ? null : (
                              <span
                                className={
                                  difference.isNegative()
                                    ? "text-red-700"
                                    : "text-amber-700"
                                }
                              >
                                {" "}
                                ({difference.isNegative()
                                  ? "short"
                                  : "extra"}{" "}
                                {difference.abs().toString()})
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>
                        {summary.short} short · {summary.extra} extra ·{" "}
                        {summary.matched} matched
                      </div>
                      {delivery.qualityRating ? (
                        <div>Quality {delivery.qualityRating}/5</div>
                      ) : null}
                      {delivery.completionNote ? (
                        <div className="max-w-xs whitespace-pre-wrap text-muted-foreground">
                          {delivery.completionNote}
                        </div>
                      ) : null}
                    </TableCell>
                  </tr>
                );
              })
            ) : (
              <tr>
                <TableCell colSpan={4}>
                  No delivery counts found for these filters.
                </TableCell>
              </tr>
            )}
          </tbody>
        </Table>
      </DataTableCard>
      <nav
        aria-label="Delivery report pages"
        className="flex justify-end gap-3"
      >
        {page > 1 ? (
          <Button asChild variant="outline">
            <Link href={pageHref(page - 1)}>Previous</Link>
          </Button>
        ) : null}
        {page < pages ? (
          <Button asChild variant="outline">
            <Link href={pageHref(page + 1)}>Next</Link>
          </Button>
        ) : null}
      </nav>
    </AdminPage>
  );
}
