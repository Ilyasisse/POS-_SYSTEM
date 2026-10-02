import AutoSubmitSelect from "@/components/AutoSubmitSelect";
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
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { normalizeFilterChoice } from "@/lib/admin/admin-filters";
import {
  orderHistoryPage,
  parseOrderHistorySearch,
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
const PAGE_SIZE = 20;

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
  const orderNumber = parseOrderHistorySearch(q);
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
    ...(q ? { orderNumber: orderNumber ?? -1 } : {}),
  };

  const [matchingCount, ordersToday] = await Promise.all([
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
  const page = orderHistoryPage(params?.page, matchingCount, PAGE_SIZE);
  const recentOrders = await prisma.order.findMany({
    where,
    take: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: {
      table: { select: { name: true } },
      waiter: { select: { fullName: true } },
      cashier: { select: { fullName: true } },
      _count: { select: { orderItems: true } },
    },
  });

  function pageHref(nextPage: number) {
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    if (status !== "all") query.set("status", status);
    if (date !== "today") query.set("date", date);
    query.set("page", String(nextPage));
    return `/admin/orders?${query.toString()}`;
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
          <p className="text-sm font-medium text-slate-500">
            {matchingCount > 0
              ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${(page - 1) * PAGE_SIZE + recentOrders.length} of ${matchingCount} orders`
              : "No matching orders"}
          </p>
        }
      >
        <SearchToolbar
          placeholder="Search by order number..."
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
                    {index + 1}
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
        {q && orderNumber === null ? (
          <p className="px-4 py-3 text-sm text-amber-700">
            Enter a whole order number, such as 123 or #123.
          </p>
        ) : null}
        {matchingCount > PAGE_SIZE ? (
          <nav
            aria-label="Order history pages"
            className="flex items-center justify-between gap-3 px-4 py-4 text-sm"
          >
            {page > 1 ? (
              <Link
                href={pageHref(page - 1)}
                className="rounded-lg border px-4 py-2 font-semibold hover:bg-slate-50"
              >
                Previous
              </Link>
            ) : (
              <span />
            )}
            <span>
              Page {page} of {Math.ceil(matchingCount / PAGE_SIZE)}
            </span>
            {page * PAGE_SIZE < matchingCount ? (
              <Link
                href={pageHref(page + 1)}
                className="rounded-lg border px-4 py-2 font-semibold hover:bg-slate-50"
              >
                Next
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </DataTableCard>
    </AdminPage>
  );
}
