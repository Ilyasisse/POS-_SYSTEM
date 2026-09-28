import AutoSubmitSelect from "@/components/AutoSubmitSelect";
import Link from "next/link";
import {
  AdminPage,
  SearchToolbar,
  MetricCard,
  Table,
  DataTableCard,
  TableCell,
  TableHead,
  ToneBadge,
} from "@/components/admin/shared";
import { prisma } from "@/lib/prisma";
import { normalizeFilterChoice } from "@/lib/admin/admin-filters";
import {
  ORDER_HISTORY_PAGE_SIZE,
  orderHistoryPage,
} from "@/lib/admin/order-history-pagination";

type AdminOrdersPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    date?: string;
    page?: string;
  }>;
};

const ORDER_STATUS_FILTERS = ["all", "OPEN", "PAID", "CANCELLED"] as const;
const ORDER_DATE_FILTERS = ["today", "all"] as const;

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatDateTime(date: Date) {
  return dateTimeFormatter.format(date);
}

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

function getStatusTone(status: string) {
  if (status === "PAID") return "green" as const;
  if (status === "OPEN") return "amber" as const;
  return "red" as const;
}

export default async function AdminOrdersPage({
  searchParams,
}: AdminOrdersPageProps) {
  const params = await searchParams;
  const q = params?.q?.trim() ?? "";
  const status = normalizeFilterChoice(
    params?.status,
    ORDER_STATUS_FILTERS,
    "all",
  );
  const date = normalizeFilterChoice(params?.date, ORDER_DATE_FILTERS, "today");
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startDate = date === "today" ? startOfToday : undefined;
  const where = {
    ...(status !== "all"
      ? { status: status as "OPEN" | "PAID" | "CANCELLED" }
      : {}),
    ...(startDate
      ? {
          createdAt: {
            gte: startDate,
          },
        }
      : {}),
    ...(q && Number(q)
      ? {
          orderNumber: Number(q),
        }
      : {}),
  };

  const [orderCount, ordersToday] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where: {
        createdAt: {
          gte: startOfToday,
        },
      },
      select: {
        status: true,
        total: true,
      },
    }),
  ]);
  const pagination = orderHistoryPage(params?.page, orderCount);
  const recentOrders = await prisma.order.findMany({
    where,
    skip: pagination.skip,
    take: ORDER_HISTORY_PAGE_SIZE,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: {
      table: {
        select: {
          name: true,
        },
      },
      waiter: {
        select: {
          fullName: true,
        },
      },
      cashier: {
        select: {
          fullName: true,
        },
      },
      _count: {
        select: {
          orderItems: true,
        },
      },
    },
  });
  function pageHref(page: number) {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (status !== "all") search.set("status", status);
    if (date !== "today") search.set("date", date);
    search.set("page", String(page));
    return `/admin/orders?${search.toString()}`;
  }

  const openToday = ordersToday.filter(
    (order) => order.status === "OPEN",
  ).length;
  const paidToday = ordersToday.filter(
    (order) => order.status === "PAID",
  ).length;
  const revenueToday = ordersToday.reduce(
    (sum, order) => sum + Number(order.total),
    0,
  );

  return (
    <AdminPage title="Orders" description="Track and manage customer orders">
      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Orders Today" value={ordersToday.length} />
        <MetricCard
          label="Open vs Paid"
          value={`${openToday} / ${paidToday}`}
        />
        <MetricCard label="Revenue Today" value={formatMoney(revenueToday)} />
      </section>

      <DataTableCard
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-medium text-slate-500">
            <p>
              Showing {pagination.first} to {pagination.last} of {orderCount}{" "}
              orders
            </p>
            {pagination.pageCount > 1 ? (
              <nav
                aria-label="Order history pages"
                className="flex items-center gap-3"
              >
                {pagination.page > 1 ? (
                  <Link href={pageHref(pagination.page - 1)}>Previous</Link>
                ) : null}
                <span>
                  Page {pagination.page} of {pagination.pageCount}
                </span>
                {pagination.page < pagination.pageCount ? (
                  <Link href={pageHref(pagination.page + 1)}>Next</Link>
                ) : null}
              </nav>
            ) : null}
          </div>
        }
      >
        <SearchToolbar
          placeholder="Search orders..."
          defaultValue={q}
          hasActiveFilters={Boolean(q || status !== "all" || date !== "today")}
          clearHref="/admin/orders"
        >
          <AutoSubmitSelect name="status" defaultValue={status}>
            <option value="all">Status All</option>
            <option value="OPEN">Preparing</option>
            <option value="PAID">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </AutoSubmitSelect>
          <AutoSubmitSelect name="date" defaultValue={date}>
            <option value="today">Date Today</option>
            <option value="all">All Time</option>
          </AutoSubmitSelect>
        </SearchToolbar>
        <Table>
          <thead>
            <tr>
              <TableHead>#</TableHead>
              <TableHead>Order No.</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Items</TableHead>
            </tr>
          </thead>
          <tbody>
            {recentOrders.length === 0 ? (
              <tr>
                <TableCell colSpan={8} className="py-10 text-center">
                  No orders found.
                </TableCell>
              </tr>
            ) : (
              recentOrders.map((order, index) => (
                <tr key={order.id} className="border-b border-slate-50">
                  <TableCell className="font-bold text-slate-400">
                    {pagination.first + index}
                  </TableCell>
                  <TableCell className="font-black text-slate-950">
                    #{order.orderNumber}
                  </TableCell>
                  <TableCell>
                    {order.waiter?.fullName ??
                      order.cashier?.fullName ??
                      "Walk-in"}
                  </TableCell>
                  <TableCell>{order.type.replace("_", "-")}</TableCell>
                  <TableCell>{formatMoney(Number(order.total))}</TableCell>
                  <TableCell>
                    <ToneBadge tone={getStatusTone(order.status)}>
                      {order.status === "PAID"
                        ? "Completed"
                        : order.status === "OPEN"
                          ? "Preparing"
                          : "Cancelled"}
                    </ToneBadge>
                  </TableCell>
                  <TableCell>{formatDateTime(order.createdAt)}</TableCell>
                  <TableCell>{order._count.orderItems}</TableCell>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </DataTableCard>
    </AdminPage>
  );
}
