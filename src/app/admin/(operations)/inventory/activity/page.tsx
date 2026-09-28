import Link from "next/link";
import { Input } from "@/components/ui/input";
import {
  AdminPage,
  Button,
  DataTableCard,
  Table,
  TableCell,
  TableHead,
  ToneBadge,
} from "@/components/admin/shared";
import { canonicalUnitLabel } from "@/lib/inventory/inventory-domain";
import {
  MOVEMENT_HISTORY_PAGE_SIZE,
  movementHistoryPage,
} from "@/lib/inventory/movement-history-page";
import { prisma } from "@/lib/prisma";

type Props = { searchParams?: Promise<{ q?: string; page?: string }> };

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Nairobi",
});

function quantity(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

export default async function InventoryActivityPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = params?.q?.trim().slice(0, 100) ?? "";
  // Keep historical movements even if their supply was deleted later.
  const where = {
    itemType: "Supply",
    ...(q ? { itemName: { contains: q, mode: "insensitive" as const } } : {}),
  };
  const total = await prisma.inventoryMovement.count({ where });
  const pagination = movementHistoryPage(params?.page, total);
  const movements = await prisma.inventoryMovement.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: pagination.skip,
    take: MOVEMENT_HISTORY_PAGE_SIZE,
    select: {
      id: true,
      itemName: true,
      delta: true,
      quantityBefore: true,
      quantityAfter: true,
      canonicalUnit: true,
      reason: true,
      note: true,
      createdAt: true,
    },
  });

  function pageHref(page: number) {
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    query.set("page", String(page));
    return `/admin/inventory/activity?${query.toString()}`;
  }

  return (
    <AdminPage
      title="Inventory activity"
      description="Review recorded stock movements and quantity changes"
    >
      <Link
        href="/admin/inventory"
        className="text-sm font-semibold text-blue-700 underline"
      >
        Back to inventory
      </Link>
      <DataTableCard
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-medium text-slate-500">
            <p>
              Showing {total === 0 ? 0 : pagination.skip + 1} to{" "}
              {Math.min(pagination.skip + movements.length, total)} of {total}{" "}
              movements
            </p>
            {pagination.pageCount > 1 ? (
              <nav
                aria-label="Movement history pages"
                className="flex items-center gap-3"
              >
                {pagination.page > 1 ? (
                  <Link href={pageHref(pagination.page - 1)}>Previous</Link>
                ) : null}
                <span>
                  Page {pagination.page} of {pagination.pageCount}
                </span>
                {pagination.page < pagination.pageCount ? (
                  <Link href={pageHref(pagination.page + 1)}>Next</Link>
                ) : null}
              </nav>
            ) : null}
          </div>
        }
      >
        <form method="get" className="flex flex-wrap items-center gap-2 p-4">
          <Input
            name="q"
            aria-label="Search supply name"
            placeholder="Search supply name"
            defaultValue={q}
            maxLength={100}
            className="max-w-sm"
          />
          <Button type="submit">Search</Button>
          {q ? <Link href="/admin/inventory/activity">Clear</Link> : null}
        </form>
        <Table>
          <thead>
            <tr>
              <TableHead>Date</TableHead>
              <TableHead>Supply</TableHead>
              <TableHead>Change</TableHead>
              <TableHead>Before</TableHead>
              <TableHead>After</TableHead>
              <TableHead>Reason and note</TableHead>
            </tr>
          </thead>
          <tbody>
            {movements.length === 0 ? (
              <tr>
                <TableCell colSpan={6} className="py-10 text-center">
                  No stock movements match.
                </TableCell>
              </tr>
            ) : (
              movements.map((movement) => {
                const delta = Number(movement.delta);
                const unit = canonicalUnitLabel(movement.canonicalUnit);
                return (
                  <tr
                    key={movement.id}
                    className="border-b border-slate-100 align-top"
                  >
                    <TableCell>
                      {dateFormatter.format(movement.createdAt)}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {movement.itemName}
                    </TableCell>
                    <TableCell>
                      <ToneBadge tone={delta < 0 ? "red" : "green"}>
                        {delta > 0 ? "+" : ""}
                        {quantity(delta)} {unit}
                      </ToneBadge>
                    </TableCell>
                    <TableCell>
                      {quantity(Number(movement.quantityBefore))}
                    </TableCell>
                    <TableCell>
                      {quantity(Number(movement.quantityAfter))}
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">{movement.reason}</span>
                      {movement.note ? (
                        <span className="block text-slate-500">
                          {movement.note}
                        </span>
                      ) : null}
                    </TableCell>
                  </tr>
                );
              })
            )}
          </tbody>
        </Table>
      </DataTableCard>
    </AdminPage>
  );
}
