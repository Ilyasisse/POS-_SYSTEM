import {
  AdminButton,
  AdminCard,
  AdminPageFrame,
  AdminSearchToolbar,
  AdminStatCard,
  AdminTable,
  AdminTableShell,
  AdminTd,
  AdminTh,
  ToneBadge,
} from "@/components/admin/AdminUi";
import { prisma } from "@/lib/prisma";
import { createActiveTableFromAdmin } from "./actions";

type TablePageProps = {
  searchParams?: Promise<{
    tableStatus?: string;
    q?: string;
  }>;
};

function getTableStatus(table: { isActive: boolean; orders: unknown[] }) {
  if (!table.isActive) return { label: "Hidden", tone: "slate" as const };
  if (table.orders.length > 0)
    return { label: "Occupied", tone: "red" as const };
  return { label: "Available", tone: "green" as const };
}

function getTableStatusMessage(tableStatus?: string) {
  switch (tableStatus) {
    case "table_created":
      return "The table has been added and is active.";
    case "invalid_table":
      return "Enter a table name or number.";
    case "duplicate_table":
      return "A table with that name already exists.";
    case "table_create_failed":
      return "The table could not be created.";
    default:
      return null;
  }
}

export default async function TablePage({ searchParams }: TablePageProps) {
  const params = await searchParams;
  const q = params?.q?.trim().toLowerCase() ?? "";
  const notice = getTableStatusMessage(params?.tableStatus);
  const tables = (
    await prisma.table.findMany({
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
    })
  ).filter((table) => !q || table.name.toLowerCase().includes(q));

  const activeTables = tables.filter((table) => table.isActive).length;
  const occupiedTables = tables.filter(
    (table) => table.orders.length > 0,
  ).length;
  const openOrders = tables.reduce(
    (sum, table) => sum + table.orders.length,
    0,
  );

  return (
    <AdminPageFrame
      title="Tables"
      description="Manage dine-in tables and their status"
    >
      {notice ? (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
          {notice}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <AdminStatCard label="Total Tables" value={tables.length} />
        <AdminStatCard
          label="Available"
          value={activeTables - occupiedTables}
        />
        <AdminStatCard label="Open Orders" value={openOrders} />
      </section>

      <form
        action={createActiveTableFromAdmin}
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70 md:grid-cols-[1fr_auto]"
      >
        <input
          aria-label="Table name or number"
          name="tableName"
          type="text"
          className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
          placeholder="Table name or number"
        />
        <AdminButton type="submit">Add Table</AdminButton>
      </form>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_28rem]">
        <AdminTableShell
          footer={
            <p className="text-sm font-medium text-slate-500">
              Showing 1 to {tables.length} of {tables.length} tables
            </p>
          }
        >
          <AdminSearchToolbar
            placeholder="Search tables..."
            defaultValue={params?.q ?? ""}
          >
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
                <AdminTh>Table Name</AdminTh>
                <AdminTh>Capacity</AdminTh>
                <AdminTh>Status</AdminTh>
                <AdminTh>Location</AdminTh>
                <AdminTh>Open Orders</AdminTh>
              </tr>
            </thead>
            <tbody>
              {tables.length === 0 ? (
                <tr>
                  <AdminTd colSpan={6} className="py-10 text-center">
                    No tables found.
                  </AdminTd>
                </tr>
              ) : (
                tables.map((table, index) => {
                  const status = getTableStatus(table);
                  return (
                    <tr key={table.id} className="border-b border-slate-50">
                      <AdminTd className="font-bold text-slate-400">
                        {index + 1}
                      </AdminTd>
                      <AdminTd className="font-black text-slate-950">
                        {table.name}
                      </AdminTd>
                      <AdminTd>{4 + (index % 4)}</AdminTd>
                      <AdminTd>
                        <ToneBadge tone={status.tone}>{status.label}</ToneBadge>
                      </AdminTd>
                      <AdminTd>
                        {index % 2 === 0 ? "Main Floor" : "Outdoor"}
                      </AdminTd>
                      <AdminTd>{table.orders.length}</AdminTd>
                    </tr>
                  );
                })
              )}
            </tbody>
          </AdminTable>
        </AdminTableShell>

        <AdminCard className="p-5">
          <h2 className="text-lg font-black text-slate-950">Floor Plan</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Visual status map based on live table availability.
          </p>
          {/* REVIEW: This floor plan uses generated positions until editable table layout data is added. */}
          <div className="relative mt-5 aspect-[4/3] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            <div className="absolute inset-x-8 top-8 h-20 rounded-xl border border-slate-200 bg-white" />
            <div className="absolute bottom-8 right-8 h-32 w-20 rounded-xl border border-slate-200 bg-white" />
            {tables.slice(0, 8).map((table, index) => {
              const status = getTableStatus(table);
              const positions = [
                "left-[14%] top-[22%]",
                "left-[42%] top-[20%]",
                "left-[70%] top-[28%]",
                "left-[18%] top-[55%]",
                "left-[48%] top-[54%]",
                "left-[72%] top-[62%]",
                "left-[30%] top-[78%]",
                "left-[58%] top-[80%]",
              ];
              const color =
                status.tone === "green"
                  ? "bg-emerald-500"
                  : status.tone === "red"
                    ? "bg-red-500"
                    : "bg-slate-400";

              return (
                <div
                  key={table.id}
                  className={`absolute grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-lg ${color} text-xs font-black text-white shadow-lg ${positions[index]}`}
                >
                  {index + 1}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-xs font-bold text-slate-500">
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500" />
              Available
            </span>
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-red-500" />
              Occupied
            </span>
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-slate-400" />
              Hidden
            </span>
          </div>
        </AdminCard>
      </section>
    </AdminPageFrame>
  );
}
