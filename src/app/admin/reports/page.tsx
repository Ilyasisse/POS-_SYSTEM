import { prisma } from "@/lib/prisma";

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

export default async function AdminReportsPage() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const todayOrders = await prisma.order.findMany({
    where: {
      createdAt: {
        gte: startOfToday,
        lt: startOfTomorrow,
      },
    },
    include: {
      waiter: {
        select: {
          fullName: true,
        },
      },
      orderItems: {
        select: {
          qty: true,
          station: true,
          lineTotal: true,
        },
      },
    },
  });

  const totalRevenue = todayOrders.reduce(
    (sum, order) => sum + Number(order.total),
    0
  );
  const totalItems = todayOrders.reduce(
    (sum, order) =>
      sum +
      order.orderItems.reduce((itemSum, item) => itemSum + item.qty, 0),
    0
  );

  const ordersByStatus = todayOrders.reduce<Record<string, number>>(
    (acc, order) => {
      acc[order.status] = (acc[order.status] ?? 0) + 1;
      return acc;
    },
    {}
  );

  const stationTotals = todayOrders.reduce<Record<string, number>>(
    (acc, order) => {
      for (const item of order.orderItems) {
        const station = item.station ?? "UNASSIGNED";
        acc[station] = (acc[station] ?? 0) + Number(item.lineTotal);
      }
      return acc;
    },
    {}
  );

  const waiterTotals = todayOrders.reduce<Record<string, number>>((acc, order) => {
    const waiterName = order.waiter?.fullName ?? "No waiter";
    acc[waiterName] = (acc[waiterName] ?? 0) + Number(order.total);
    return acc;
  }, {});

  const stationRows = Object.entries(stationTotals).sort((a, b) => b[1] - a[1]);
  const waiterRows = Object.entries(waiterTotals).sort((a, b) => b[1] - a[1]);

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
          <h1 className="mt-2 text-2xl font-bold">Reports</h1>
          <p className="mt-1 text-sm text-slate-600">
            Daily revenue and workload summary for today&apos;s service.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <p className="text-sm text-slate-500">Orders Today</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              {todayOrders.length}
            </h2>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <p className="text-sm text-slate-500">Revenue</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              {formatMoney(totalRevenue)}
            </h2>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <p className="text-sm text-slate-500">Items Sold</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              {totalItems}
            </h2>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <p className="text-sm text-slate-500">Paid Orders</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              {ordersByStatus.PAID ?? 0}
            </h2>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <h2 className="text-lg font-bold text-slate-800">
              Revenue By Station
            </h2>
            <div className="mt-4 space-y-3">
              {stationRows.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No station activity recorded today.
                </p>
              ) : (
                stationRows.map(([station, total]) => (
                  <div
                    key={station}
                    className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
                  >
                    <span className="font-medium text-slate-700">{station}</span>
                    <span className="font-semibold text-slate-900">
                      {formatMoney(total)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <h2 className="text-lg font-bold text-slate-800">Sales By Waiter</h2>
            <div className="mt-4 space-y-3">
              {waiterRows.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No waiter-linked sales recorded today.
                </p>
              ) : (
                waiterRows.map(([waiter, total]) => (
                  <div
                    key={waiter}
                    className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
                  >
                    <span className="font-medium text-slate-700">{waiter}</span>
                    <span className="font-semibold text-slate-900">
                      {formatMoney(total)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
          <h2 className="text-lg font-bold text-slate-800">Order Status Mix</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {(["OPEN", "PAID", "CANCELLED"] as const).map((status) => (
              <div
                key={status}
                className="rounded-xl border border-slate-200 px-4 py-4"
              >
                <p className="text-sm text-slate-500">{status}</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {ordersByStatus[status] ?? 0}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
