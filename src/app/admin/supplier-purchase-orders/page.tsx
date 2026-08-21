import Link from "next/link";
import type { SupplierPurchaseOrderStatus } from "@prisma/client";
import {
  AdminPage,
  Button,
  ClearFiltersLink,
  DataTableCard,
  MetricCard,
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
  searchParams?: Promise<{ supplier?: string; status?: string }>;
}) {
  await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const query = (await searchParams) ?? {};
  const status = ORDER_STATUSES.includes(
    query.status as SupplierPurchaseOrderStatus,
  )
    ? (query.status as SupplierPurchaseOrderStatus)
    : undefined;
  const [orders, suppliers] = await Promise.all([
    prisma.supplierPurchaseOrder.findMany({
      where: {
        supplierId: query.supplier || undefined,
        status,
      },
      include: {
        supplier: { select: { name: true } },
        createdBy: { select: { fullName: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.supplier.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const openOrders = orders.filter((order) => order.status === "OPEN");
  const openTotal = openOrders.reduce(
    (total, order) => total + Number(order.totalAmount),
    0,
  );
  const completedCount = orders.filter(
    (order) => order.status === "COMPLETED",
  ).length;

  return (
    <AdminPage
      title="Supplier purchase orders"
      description="Record orders placed by phone, track expected delivery dates, and preserve historical supplier prices."
      action={
        <>
          <Button asChild>
            <Link href="/admin/supplier-purchase-orders/new">
              Create purchase order
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/supplier-invoices">View invoices</Link>
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
        <MetricCard label="Open orders" value={openOrders.length} />
        <MetricCard label="Open order value" value={formatMoney(openTotal)} />
        <MetricCard label="Completed in results" value={completedCount} />
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
                <TableCell colSpan={7}>
                  No supplier purchase orders match these filters.
                </TableCell>
              </tr>
            )}
          </tbody>
        </Table>
      </DataTableCard>
    </AdminPage>
  );
}
