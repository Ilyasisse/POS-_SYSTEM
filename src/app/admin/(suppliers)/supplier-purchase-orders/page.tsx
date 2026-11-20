import Link from "next/link";
import type { SupplierPurchaseOrderStatus } from "@prisma/client";
import {
  AdminPage,
  Button,
  ClearFiltersLink,
  DataTableCard,
  MetricCard,
  PaginationBar,
  Table,
  TableCell,
  TableHead,
  ToneBadge,
} from "@/components/admin/shared";
import AutoSubmitSelect from "@/components/AutoSubmitSelect";
import { formatMoney } from "@/lib/admin/helper/formatMoney";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import {
  PURCHASE_ORDER_PAGE_SIZE,
  purchaseOrderFilterQuery,
  purchaseOrderPage,
} from "@/lib/suppliers/purchase-order-pagination";

const ORDER_STATUSES = ["OPEN", "COMPLETED", "CANCELLED"] as const;
const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

function statusTone(status: SupplierPurchaseOrderStatus) {
  if (status === "COMPLETED") return "green" as const;
  if (status === "CANCELLED") return "red" as const;
  return "amber" as const;
}

export default async function SupplierPurchaseOrdersPage({
  searchParams,
}: {
  searchParams?: Promise<{ supplier?: string; status?: string; page?: string }>;
}) {
  await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const query = (await searchParams) ?? {};
  const status = ORDER_STATUSES.includes(
    query.status as SupplierPurchaseOrderStatus,
  )
    ? (query.status as SupplierPurchaseOrderStatus)
    : undefined;
  const where = { supplierId: query.supplier || undefined, status };
  const [statusSummaries, suppliers] = await Promise.all([
    prisma.supplierPurchaseOrder.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    prisma.supplier.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const totalOrders = statusSummaries.reduce(
    (total, summary) => total + summary._count._all,
    0,
  );
  const openSummary = statusSummaries.find(
    (summary) => summary.status === "OPEN",
  );
  const completedCount =
    statusSummaries.find((summary) => summary.status === "COMPLETED")?._count
      ._all ?? 0;
  const { page, totalPages, skip } = purchaseOrderPage(query.page, totalOrders);
  const orders = await prisma.supplierPurchaseOrder.findMany({
    where,
    include: {
      supplier: { select: { name: true } },
      createdBy: { select: { fullName: true } },
      _count: { select: { items: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip,
    take: PURCHASE_ORDER_PAGE_SIZE,
  });

  return (
    <AdminPage
      title="Supplier purchase orders"
      description="Record orders placed by phone, track expected delivery dates, and preserve historical supplier prices."
      action={
        <>
          <Button asChild>
            <Link prefetch={false} href="/admin/supplier-purchase-orders/new">
              Create purchase order
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link prefetch={false} href="/admin/supplier-invoices">
              View invoices
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link prefetch={false} href="/admin/supplier-order-schedules">
              WhatsApp schedules
            </Link>
          </Button>
        </>
      }
    >
      <form
        method="get"
        className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center"
      >
        <AutoSubmitSelect
          name="supplier"
          defaultValue={query.supplier || ""}
          aria-label="Supplier"
          className="w-full"
        >
          <option value="">All suppliers</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </AutoSubmitSelect>
        <AutoSubmitSelect
          name="status"
          defaultValue={status || ""}
          aria-label="Purchase order status"
          className="w-full"
        >
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </AutoSubmitSelect>
        <ClearFiltersLink
          href="/admin/supplier-purchase-orders"
          show={Boolean(query.supplier || status)}
        />
      </form>

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Open orders" value={openSummary?._count._all ?? 0} />
        <MetricCard
          label="Open order value"
          value={formatMoney(Number(openSummary?._sum.totalAmount ?? 0))}
        />
        <MetricCard label="Completed orders" value={completedCount} />
      </section>

      <DataTableCard>
        <Table>
          <thead>
            <tr>
              <TableHead>Order</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Expected delivery</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
            </tr>
          </thead>
          <tbody>
            {orders.length ? (
              orders.map((order) => (
                <tr key={order.id} className="border-t">
                  <TableCell>
                    <Link
                      prefetch={false}
                      href={`/admin/supplier-purchase-orders/${order.id}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      PO #{order.orderNumber}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {order.createdAt.toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {order.supplier.name}
                  </TableCell>
                  <TableCell>
                    {DATE_FORMATTER.format(order.expectedDeliveryDate)}
                  </TableCell>
                  <TableCell>{order._count.items}</TableCell>
                  <TableCell className="font-semibold tabular-nums">
                    {formatMoney(Number(order.totalAmount))}
                  </TableCell>
                  <TableCell>
                    <ToneBadge tone={statusTone(order.status)}>
                      {order.status}
                    </ToneBadge>
                  </TableCell>
                </tr>
              ))
            ) : (
              <tr>
                <TableCell colSpan={6}>
                  No supplier purchase orders match these filters.
                </TableCell>
              </tr>
            )}
          </tbody>
        </Table>
        <div className="border-t p-4">
          <PaginationBar
            currentPage={page}
            totalPages={totalPages}
            totalLabel={`Showing ${totalOrders ? skip + 1 : 0}–${skip + orders.length} of ${totalOrders} purchase orders`}
            baseQuery={purchaseOrderFilterQuery(query.supplier, status)}
          />
        </div>
      </DataTableCard>
    </AdminPage>
  );
}
