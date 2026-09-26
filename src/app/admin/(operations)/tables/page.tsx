import { Input } from "@/components/ui/input";
import {
  Button,
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
import { createActiveTableFromAdmin } from "./actions";
import { ToastOnMount } from "@/components/ui/toast";
import TableFloorPlan from "./TableFloorPlan";

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
        <ToastOnMount tone={notice.tone} description={notice.message} />
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Total Tables" value={tables.length} />
        <MetricCard label="Available" value={activeTables - occupiedTables} />
        <MetricCard label="Open Orders" value={openOrders} />
      </section>

      <form
        action={createActiveTableFromAdmin}
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70 md:grid-cols-[1fr_auto]"
      >
        <Input
          aria-label="Table name or number"
          name="tableName"
          type="text"
          className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
          placeholder="Table name or number"
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
              </tr>
            </thead>
            <tbody>
              {tables.length === 0 ? (
                <tr>
                  <TableCell colSpan={6} className="py-10 text-center">
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
                      <TableCell>{4 + (index % 4)}</TableCell>
                      <TableCell>
                        <ToneBadge tone={status.tone}>{status.label}</ToneBadge>
                      </TableCell>
                      <TableCell>
                        {index % 2 === 0 ? "Main Floor" : "Outdoor"}
                      </TableCell>
                      <TableCell>{table.orders.length}</TableCell>
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </DataTableCard>

        <TableFloorPlan
          tables={tables.map((table) => ({
            id: table.id,
            name: table.name,
            isActive: table.isActive,
            occupied: table.orders.length > 0,
            floorX: table.floorX,
            floorY: table.floorY,
          }))}
        />
      </section>
    </AdminPage>
  );
}
