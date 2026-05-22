import { prisma } from "@/lib/prisma";
import { createActiveTableFromAdmin } from "./actions";

type TablePageProps = {
  searchParams?: Promise<{
    tableStatus?: string;
  }>;
};

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getTableStatusMessage(tableStatus?: string) {
  switch (tableStatus) {
    case "table_created":
      return {
        tone: "success" as const,
        message: "The table has been added and is active.",
      };
    case "invalid_table":
      return {
        tone: "error" as const,
        message: "Enter a table name or number.",
      };
    case "duplicate_table":
      return {
        tone: "error" as const,
        message: "A table with that name already exists.",
      };
    case "table_create_failed":
      return {
        tone: "error" as const,
        message: "The table could not be created.",
      };
    default:
      return null;
  }
}

function getDiningTableStatus(table: {
  isActive: boolean;
  orders: unknown[];
}) {
  if (!table.isActive) {
    return {
      label: "Hidden",
      className: "bg-slate-200 text-slate-600",
    };
  }

  if (table.orders.length > 0) {
    return {
      label: "Occupied",
      className: "bg-amber-100 text-amber-700",
    };
  }

  return {
    label: "Available",
    className: "bg-emerald-100 text-emerald-700",
  };
}

export default async function TablePage({ searchParams }: TablePageProps) {
  const params = await searchParams;
  const tableNotice = getTableStatusMessage(params?.tableStatus);
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

        {tableNotice ? (
          <div
            className={`rounded-2xl px-4 py-3 text-sm font-medium ${
              tableNotice.tone === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {tableNotice.message}
          </div>
        ) : null}

        <form
          action={createActiveTableFromAdmin}
          className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg md:grid-cols-[1fr_auto] md:items-end"
        >
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">
              Add table
            </span>
            <input
              name="tableName"
              type="text"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              placeholder="1, Table 1, VIP 2"
            />
          </label>
          <button
            type="submit"
            className="min-h-12 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Add active table
          </button>
        </form>

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
                    const tableStatus = getDiningTableStatus(table);

                    return (
                      <tr key={table.id} className="border-b border-slate-100">
                        <td className="px-3 py-2 font-semibold text-slate-700">
                          {table.name}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${tableStatus.className}`}
                          >
                            {tableStatus.label}
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
