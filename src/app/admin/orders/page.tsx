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
import { prisma } from "@/lib/prisma";
import { normalizeFilterChoice } from "@/lib/admin/admin-filters";
import { ToastOnMount } from "@/components/ui/toast";
import { emailReceiptFromAdmin } from "./actions";

type AdminOrdersPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    date?: string;
    receiptStatus?: string;
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
  const date = normalizeFilterChoice(
    params?.date,
    ORDER_DATE_FILTERS,
    "today",
  );
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

  const [recentOrders, ordersToday] = await Promise.all([
    prisma.order.findMany({
      where,
      take: 20,
      orderBy: {
        createdAt: "desc",
      },
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
        customer: {
          select: {
            email: true,
          },
        },
        _count: {
          select: {
            orderItems: true,
          },
        },
      },
    }),
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
      {params?.receiptStatus === "sent" ? (
        <ToastOnMount
          tone="success"
          description="Receipt email accepted for delivery."
        />
      ) : null}
      {params?.receiptStatus === "configuration_missing" ? (
        <ToastOnMount
          tone="error"
          description="Receipt email is not configured. Add RESEND_API_KEY and RECEIPT_EMAIL_FROM."
        />
      ) : null}
      {params?.receiptStatus === "invalid_email" ? (
        <ToastOnMount
          tone="error"
          description="Enter a valid receipt email address."
        />
      ) : null}
      {params?.receiptStatus === "failed" ? (
        <ToastOnMount
          tone="error"
          description="The receipt could not be emailed. The failed attempt was logged."
        />
      ) : null}
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
            Showing 1 to {recentOrders.length} orders
          </p>
        }
      >
        <SearchToolbar
          placeholder="Search orders..."
          defaultValue={q}
          hasActiveFilters={Boolean(
            q || status !== "all" || date !== "today",
          )}
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
              <TableHead>Email receipt</TableHead>
            </tr>
          </thead>
          <tbody>
            {recentOrders.length === 0 ? (
              <tr>
                <TableCell colSpan={9} className="py-10 text-center">
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
                  <TableCell>
                    {order.status === "PAID" ? (
                      <form
                        action={emailReceiptFromAdmin}
                        className="flex min-w-64 gap-2"
                      >
                        <input type="hidden" name="orderId" value={order.id} />
                        <input
                          aria-label={`Receipt email for order ${order.orderNumber}`}
                          name="recipient"
                          type="email"
                          required
                          maxLength={254}
                          defaultValue={order.customer?.email ?? ""}
                          placeholder="customer@example.com"
                          className="h-9 min-w-0 flex-1 rounded-md border border-slate-200 px-2 text-sm"
                        />
                        <button
                          type="submit"
                          className="h-9 rounded-md bg-slate-900 px-3 text-xs font-bold text-white hover:bg-slate-700"
                        >
                          Send
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs text-slate-400">
                        Available after payment
                      </span>
                    )}
                  </TableCell>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </DataTableCard>
    </AdminPage>
  );
}
