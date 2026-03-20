import { prisma } from "@/lib/prisma";

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default async function TablePage() {
  const tables = await prisma.table.findMany({
    orderBy: {
      name: "asc",
    },
    include: {
      orders: {
        where: {
          status: "OPEN",
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          orderNumber: true,
          createdAt: true,
          total: true,
        },
      },
    },
  });

  const activeTables = tables.filter((table) => table.isActive).length;
  const occupiedTables = tables.filter((table) => table.orders.length > 0).length;
  const openOrders = tables.reduce((sum, table) => sum + table.orders.length, 0);

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
          <h1 className="mt-2 text-2xl font-bold">Tables</h1>
          <p className="mt-1 text-sm text-slate-600">
            Monitor dine-in tables, active service coverage, and open table
            orders.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <p className="text-sm text-slate-500">Total Tables</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              {tables.length}
            </h2>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <p className="text-sm text-slate-500">Active Tables</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              {activeTables}
            </h2>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <p className="text-sm text-slate-500">Occupied Tables</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              {occupiedTables}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {openOrders} open orders across tables
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-800">Dining Tables</h2>
            <p className="text-sm text-slate-500">{tables.length} tables</p>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-3 py-2 font-semibold">Table</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Open Orders</th>
                  <th className="px-3 py-2 font-semibold">Latest Order</th>
                  <th className="px-3 py-2 font-semibold">Latest Total</th>
                </tr>
              </thead>

              <tbody>
                {tables.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-6 text-center text-slate-500"
                    >
                      No tables found.
                    </td>
                  </tr>
                ) : (
                  tables.map((table) => {
                    const latestOrder = table.orders[0] ?? null;

                    return (
                      <tr key={table.id} className="border-b border-slate-100">
                        <td className="px-3 py-2 font-semibold text-slate-700">
                          {table.name}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              table.isActive
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {table.isActive ? "Active" : "Hidden"}
                          </span>
                        </td>
                        <td className="px-3 py-2">{table.orders.length}</td>
                        <td className="px-3 py-2">
                          {latestOrder
                            ? `#${latestOrder.orderNumber} ${formatDateTime(latestOrder.createdAt)}`
                            : "-"}
                        </td>
                        <td className="px-3 py-2">
                          {latestOrder
                            ? `$${Number(latestOrder.total).toFixed(2)}`
                            : "-"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
