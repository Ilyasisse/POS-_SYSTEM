import { Input } from "@/components/ui/input";
import {
  Button,
  Card,
  AdminPage,
  SearchToolbar,
  MetricCard,
  RowActions,
  Table,
  DataTableCard,
  TableCell,
  TableHead,
  ToneBadge,
} from "@/components/admin/shared";
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
      return "Enter a valid table name, section, and capacity from 1 to 50.";
    case "duplicate_table":
      return "A table with that name already exists.";
    case "table_create_failed":
      return "The table could not be created.";
    case "table_updated":
      return "The table details were updated.";
    case "occupied_table":
      return "An occupied table cannot be hidden. Settle or transfer its open orders first.";
    case "table_not_found":
      return "The table no longer exists.";
    case "table_update_failed":
      return "The table could not be updated.";
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
    <AdminPage
      title="Tables"
      description="Manage dine-in tables and their status"
    >
      {notice ? (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
          {notice}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Total Tables" value={tables.length} />
        <MetricCard label="Available" value={activeTables - occupiedTables} />
        <MetricCard label="Open Orders" value={openOrders} />
      </section>

      <form
        action={createActiveTableFromAdmin}
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70 md:grid-cols-[1fr_9rem_1fr_auto]"
      >
        <Input
          aria-label="Table name or number"
          name="tableName"
          type="text"
          className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
          placeholder="Table name or number"
          required
        />
        <Input
          aria-label="Seating capacity"
          name="capacity"
          type="number"
          min={1}
          max={50}
          defaultValue={4}
          required
        />
        <Input
          aria-label="Floor section"
          name="section"
          type="text"
          maxLength={80}
          defaultValue="Main Floor"
          required
        />
        <Button type="submit">Add Table</Button>
      </form>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_28rem]">
        <DataTableCard
          footer={
            <p className="text-sm font-medium text-slate-500">
              Showing 1 to {tables.length} of {tables.length} tables
            </p>
          }
        >
          <SearchToolbar
            placeholder="Search tables..."
            defaultValue={params?.q ?? ""}
            hasActiveFilters={Boolean(q)}
            clearHref="/admin/tables"
          />
          <Table>
            <thead>
              <tr>
                <TableHead>#</TableHead>
                <TableHead>Table Name</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Open Orders</TableHead>
                <TableHead>Action</TableHead>
              </tr>
            </thead>
            <tbody>
              {tables.length === 0 ? (
                <tr>
                  <TableCell colSpan={7} className="py-10 text-center">
                    No tables found.
                  </TableCell>
                </tr>
              ) : (
                tables.map((table, index) => {
                  const status = getTableStatus(table);
                  return (
                    <tr key={table.id} className="border-b border-slate-50">
                      <TableCell className="font-bold text-slate-400">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-black text-slate-950">
                        {table.name}
                      </TableCell>
                      <TableCell>{table.capacity}</TableCell>
                      <TableCell>
                        <ToneBadge tone={status.tone}>{status.label}</ToneBadge>
                      </TableCell>
                      <TableCell>
                        {table.section}
                      </TableCell>
                      <TableCell>{table.orders.length}</TableCell>
                      <TableCell>
                        <RowActions editHref={`/admin/tables/${table.id}`} />
                      </TableCell>
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </DataTableCard>

        <Card className="p-5">
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
        </Card>
      </section>
    </AdminPage>
  );
}
