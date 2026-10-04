import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPage, Button, Card } from "@/components/admin/shared";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { prisma } from "@/lib/prisma";
import { updateTableMetadata } from "../actions";

type TableDetailsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function TableDetailsPage({
  params,
}: TableDetailsPageProps) {
  const { id } = await params;
  const table = await prisma.table.findUnique({
    where: { id },
    include: {
      orders: {
        where: { status: "OPEN" },
        select: { id: true },
      },
    },
  });

  if (!table) notFound();

  return (
    <AdminPage
      title={`Edit ${table.name}`}
      description="Set the table's seating capacity, floor section, and visibility."
      action={
        <Link
          href="/admin/tables"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold hover:bg-slate-50"
        >
          Back to tables
        </Link>
      }
    >
      {table.orders.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          This table has {table.orders.length} open order
          {table.orders.length === 1 ? "" : "s"}. It can be renamed or moved,
          but it cannot be hidden until those orders are settled or transferred.
        </div>
      ) : null}

      <Card className="max-w-2xl p-6">
        <form action={updateTableMetadata} className="grid gap-5">
          <Input type="hidden" name="id" value={table.id} />
          <label className="grid gap-2 text-sm font-bold">
            Table name
            <Input
              name="name"
              defaultValue={table.name}
              maxLength={80}
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            Seating capacity
            <Input
              name="capacity"
              type="number"
              min={1}
              max={50}
              defaultValue={table.capacity}
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            Floor section
            <Input
              name="section"
              defaultValue={table.section}
              maxLength={80}
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            Visibility
            <NativeSelect
              name="isActive"
              defaultValue={table.isActive ? "active" : "inactive"}
            >
              <option value="active">Visible</option>
              <option value="inactive">Hidden</option>
            </NativeSelect>
          </label>
          <Button type="submit" className="w-fit">
            Save table
          </Button>
        </form>
      </Card>
    </AdminPage>
  );
}
