import { Input } from "@/components/ui/input";
import {
  Button,
  Card,
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
import { createActiveTableFromAdmin, updateTableCleaningStatus } from "./actions";
import { ToastOnMount } from "@/components/ui/toast";

type TablePageProps = {
  searchParams?: Promise<{
    tableStatus?: string;
    q?: string;
  }>;
};

function getTableStatus(table: { isActive: boolean; needsCleaning: boolean; orders: unknown[] }) {
  if (!table.isActive) return { label: "Hidden", tone: "slate" as const };
  if (table.orders.length > 0) return { label: "Occupied", tone: "red" as const };
  if (table.needsCleaning) return { label: "Needs cleaning", tone: "amber" as const };
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
    case "table_cleaned":
      return {
        tone: "success" as const,
        message: "Table is ready for guests.",
      };
    case "table_needs_cleaning":
      return {
        tone: "success" as const,
        message: "Table marked for cleaning.",
      };
    case "cleaning_unavailable":
      return {
        tone: "warning" as const,
        message:
          "Only an empty active table can change cleaning status. Refresh and check its open orders.",
      };
    case "invalid_cleaning_action":
    case "cleaning_failed":
      return {
        tone: "error" as const,
        message: "Could not update the table. Try again.",
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

  const availableTables = tables.filter(
    (table) => table.isActive && !table.needsCleaning && !table.orders.length,
  ).length;
  const openOrders = tables.reduce((sum, table) => sum + table.orders.length, 0);

  return (
    <AdminPage title="Tables" description="Manage dine-in tables and their status">
      {notice ? <ToastOnMount tone={notice.tone} description={notice.message} /> : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Total Tables" value={tables.length} />
        <MetricCard label="Available" value={availableTables} />
        <MetricCard label="Open Orders" value={openOrders} />
      </section>

      <form
        action={createActiveTableFromAdmin}
        className="border-border bg-card grid gap-3 rounded-2xl border p-4 shadow-sm shadow-black/70 md:grid-cols-[1fr_auto]"
      >
        <Input
          aria-label="Table name or number"
          name="tableName"
          type="text"
          className="border-border h-11 rounded-lg border px-3 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 dark:focus:border-blue-800 dark:focus:ring-blue-800"
          placeholder="Table name or number"
        />
        <Button type="submit">Add Table</Button>
      </form>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_28rem]">
        <DataTableCard
          footer={
            <p className="text-muted-foreground text-sm font-medium">
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
                <TableHead>Cleaning</TableHead>
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
                    <tr key={table.id} className="border-border border-b">
                      <TableCell className="text-muted-foreground font-bold">{index + 1}</TableCell>
                      <TableCell className="text-foreground font-black">{table.name}</TableCell>
                      <TableCell>{4 + (index % 4)}</TableCell>
                      <TableCell>
                        <ToneBadge tone={status.tone}>{status.label}</ToneBadge>
                      </TableCell>
                      <TableCell>{index % 2 === 0 ? "Main Floor" : "Outdoor"}</TableCell>
                      <TableCell>{table.orders.length}</TableCell>
                      <TableCell>
                        {table.isActive && table.orders.length === 0 ? (
                          <form action={updateTableCleaningStatus}>
                            <input type="hidden" name="tableId" value={table.id} />
                            <input
                              type="hidden"
                              name="nextStatus"
                              value={table.needsCleaning ? "clean" : "needs_cleaning"}
                            />
                            <Button type="submit" variant="outline" size="sm">
                              {table.needsCleaning ? "Mark clean" : "Needs cleaning"}
                            </Button>
                          </form>
                        ) : null}
                      </TableCell>
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </DataTableCard>

        <Card className="p-5">
          <h2 className="text-foreground text-lg font-black">Floor Plan</h2>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Visual status map based on live table availability.
          </p>
          {/* REVIEW: This floor plan uses generated positions until editable table layout data is added. */}
          <div className="border-border bg-card relative mt-5 aspect-[4/3] overflow-hidden rounded-2xl border">
            <div className="border-border bg-card absolute inset-x-8 top-8 h-20 rounded-xl border" />
            <div className="border-border bg-card absolute right-8 bottom-8 h-32 w-20 rounded-xl border" />
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
                    : status.tone === "amber"
                      ? "bg-amber-500"
                      : "bg-muted";

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
          <div className="text-muted-foreground mt-4 flex flex-wrap gap-4 text-xs font-bold">
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-amber-500" />
              Needs cleaning
            </span>
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500" />
              Available
            </span>
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-red-500" />
              Occupied
            </span>
            <span className="flex items-center gap-2">
              <span className="bg-muted size-2 rounded-full" />
              Hidden
            </span>
          </div>
        </Card>
      </section>
    </AdminPage>
  );
}
