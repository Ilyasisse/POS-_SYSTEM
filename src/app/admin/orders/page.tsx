import {
  AdminPageFrame,
  AdminSearchToolbar,
  AdminSelect,
  AdminStatCard,
  AdminTable,
  AdminTableShell,
  AdminTd,
  AdminTh,
  ToneBadge,
} from "@/components/admin/AdminUi";
import { prisma } from "@/lib/prisma";

type AdminOrdersPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    date?: string;
  }>;
};

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
  const status = params?.status ?? "all";
  const date = params?.date ?? "today";
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
    <AdminPageFrame
      title="Orders"
      description="Track and manage customer orders"
    >
      <section className="grid gap-4 sm:grid-cols-3">
        <AdminStatCard label="Orders Today" value={ordersToday.length} />
        <AdminStatCard
          label="Open vs Paid"
          value={`${openToday} / ${paidToday}`}
        />
        <AdminStatCard
          label="Revenue Today"
          value={formatMoney(revenueToday)}
        />
      </section>

      <AdminTableShell
        footer={
          <p className="text-sm font-medium text-slate-500">
            Showing 1 to {recentOrders.length} orders
          </p>
        }
      >
        <AdminSearchToolbar placeholder="Search orders..." defaultValue={q}>
          <AdminSelect name="status" defaultValue={status}>
            <option value="all">Status All</option>
            <option value="OPEN">Preparing</option>
            <option value="PAID">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </AdminSelect>
          <AdminSelect name="date" defaultValue={date}>
            <option value="today">Date Today</option>
            <option value="all">All Time</option>
          </AdminSelect>
          <button
            type="submit"
            className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            Filter
          </button>
        </AdminSearchToolbar>
        <AdminTable>
          <thead>
            <tr>
              <AdminTh>#</AdminTh>
              <AdminTh>Order No.</AdminTh>
              <AdminTh>Customer</AdminTh>
              <AdminTh>Type</AdminTh>
              <AdminTh>Total</AdminTh>
              <AdminTh>Status</AdminTh>
              <AdminTh>Time</AdminTh>
              <AdminTh>Items</AdminTh>
            </tr>
          </thead>
          <tbody>
            {recentOrders.length === 0 ? (
              <tr>
                <AdminTd colSpan={8} className="py-10 text-center">
                  No orders found.
                </AdminTd>
              </tr>
            ) : (
              recentOrders.map((order, index) => (
                <tr key={order.id} className="border-b border-slate-50">
                  <AdminTd className="font-bold text-slate-400">
                    {index + 1}
                  </AdminTd>
                  <AdminTd className="font-black text-slate-950">
                    #{order.orderNumber}
                  </AdminTd>
                  <AdminTd>
                    {order.waiter?.fullName ??
                      order.cashier?.fullName ??
                      "Walk-in"}
                  </AdminTd>
                  <AdminTd>{order.type.replace("_", "-")}</AdminTd>
                  <AdminTd>{formatMoney(Number(order.total))}</AdminTd>
                  <AdminTd>
                    <ToneBadge tone={getStatusTone(order.status)}>
                      {order.status === "PAID"
                        ? "Completed"
                        : order.status === "OPEN"
                          ? "Preparing"
                          : "Cancelled"}
                    </ToneBadge>
                  </AdminTd>
                  <AdminTd>{formatDateTime(order.createdAt)}</AdminTd>
                  <AdminTd>{order._count.orderItems}</AdminTd>
                </tr>
              ))
            )}
          </tbody>
        </AdminTable>
      </AdminTableShell>
    </AdminPageFrame>
  );
}
