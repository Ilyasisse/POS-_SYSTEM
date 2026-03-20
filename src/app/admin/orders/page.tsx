import { prisma } from "@/lib/prisma";

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

export default async function AdminOrdersPage() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [recentOrders, ordersToday] = await Promise.all([
    prisma.order.findMany({
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

  const openToday = ordersToday.filter((order) => order.status === "OPEN").length;
  const paidToday = ordersToday.filter((order) => order.status === "PAID").length;
  const revenueToday = ordersToday.reduce(
    (sum, order) => sum + Number(order.total),
    0
  );

  return (
    <main
      className="min-h-screen bg-linear-to-br from-slate-100 via-slate-50 to-blue-50 px-4 py-6 text-slate-900 md:px-6"
      style={{ fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif' }}
    >
      <div className="mx-auto w-full max-w-6xl space-y-4 pb-24">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Admin Dashboard
          </p>
          <h1 className="mt-2 text-2xl font-bold">Orders</h1>
          <p className="mt-1 text-sm text-slate-600">
            Track recent orders, payment progress, and service activity across
            the cafe.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <p className="text-sm text-slate-500">Orders Today</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              {ordersToday.length}
            </h2>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <p className="text-sm text-slate-500">Open vs Paid</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              {openToday} / {paidToday}
            </h2>
            <p className="mt-1 text-xs text-slate-500">Open / Paid today</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <p className="text-sm text-slate-500">Revenue Today</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              {formatMoney(revenueToday)}
            </h2>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-800">Recent Orders</h2>
            <p className="text-sm text-slate-500">Latest 20 orders</p>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-3 py-2 font-semibold">Order</th>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Table</th>
                  <th className="px-3 py-2 font-semibold">Waiter</th>
                  <th className="px-3 py-2 font-semibold">Cashier</th>
                  <th className="px-3 py-2 font-semibold">Items</th>
                  <th className="px-3 py-2 font-semibold">Total</th>
                  <th className="px-3 py-2 font-semibold">Created</th>
                </tr>
              </thead>

              <tbody>
                {recentOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-3 py-6 text-center text-slate-500"
                    >
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  recentOrders.map((order) => (
                    <tr key={order.id} className="border-b border-slate-100">
                      <td className="px-3 py-2 font-semibold text-slate-700">
                        #{order.orderNumber}
                      </td>
                      <td className="px-3 py-2">{order.type}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            order.status === "PAID"
                              ? "bg-emerald-100 text-emerald-700"
                              : order.status === "OPEN"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="px-3 py-2">{order.table?.name ?? "-"}</td>
                      <td className="px-3 py-2">
                        {order.waiter?.fullName ?? "-"}
                      </td>
                      <td className="px-3 py-2">
                        {order.cashier?.fullName ?? "-"}
                      </td>
                      <td className="px-3 py-2">{order._count.orderItems}</td>
                      <td className="px-3 py-2 font-medium">
                        {formatMoney(Number(order.total))}
                      </td>
                      <td className="px-3 py-2">
                        {formatDateTime(order.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
