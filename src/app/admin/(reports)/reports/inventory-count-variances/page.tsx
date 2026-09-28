import Link from "next/link";
import { Prisma } from "@prisma/client";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;
const dateTime = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Nairobi",
});

function getApprovedAfter(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export default async function InventoryCountVariancesPage({
  searchParams,
}: {
  searchParams?: Promise<{ days?: string; page?: string }>;
}) {
  const user = await requirePermission(PERMISSIONS.REPORT_INVENTORY_VIEW);
  const params = (await searchParams) ?? {};
  const days = ["7", "30", "90"].includes(params.days ?? "")
    ? Number(params.days)
    : 30;
  const rawPage = params.page ?? "1";
  const requestedPage = /^[1-9]\d{0,3}$/.test(rawPage) ? Number(rawPage) : 1;
  const where: Prisma.InventoryCountLineWhereInput = {
    varianceQuantity: { not: 0 },
    session: {
      status: "APPROVED",
      approvedAt: { gte: getApprovedAfter(days) },
    },
  };
  const count = await prisma.inventoryCountLine.count({ where });
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const rows = await prisma.inventoryCountLine.findMany({
    where,
    include: {
      session: {
        select: {
          id: true,
          approvedAt: true,
          reason: true,
        },
      },
      product: { select: { name: true } },
      supply: { select: { name: true } },
    },
    orderBy: [{ session: { approvedAt: "desc" } }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const showCost = hasPermission(user, PERMISSIONS.INVENTORY_COST_MANAGE);
  const link = (next: number) =>
    `/admin/reports/inventory-count-variances?days=${days}&page=${next}`;

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <header>
        <Link href="/admin/inventory" className="text-sm underline">
          ← Inventory
        </Link>
        <h1 className="mt-3 text-2xl font-bold">
          Approved stock count variances
        </h1>
        <p className="text-sm text-muted-foreground">
          {count} shortage or overage line{count === 1 ? "" : "s"} approved in
          the past {days} days. Zero-variance counts are excluded.
        </p>
      </header>
      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border bg-background p-4"
      >
        <label className="grid gap-2 text-sm font-semibold">
          Approval window
          <select
            name="days"
            defaultValue={String(days)}
            className="h-10 rounded-md border bg-background px-3"
          >
            <option value="7">Past 7 days</option>
            <option value="30">Past 30 days</option>
            <option value="90">Past 90 days</option>
          </select>
        </label>
        <Button type="submit">Show variances</Button>
      </form>
      <section className="overflow-x-auto rounded-xl border bg-background">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead>
            <tr className="border-b">
              <th scope="col" className="p-3">
                Approved
              </th>
              <th scope="col" className="p-3">
                Item
              </th>
              <th scope="col" className="p-3">
                Expected
              </th>
              <th scope="col" className="p-3">
                Counted
              </th>
              <th scope="col" className="p-3">
                Difference
              </th>
              {showCost ? (
                <th scope="col" className="p-3">
                  Estimated variance cost
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const short = row.varianceQuantity.lt(0);
              const cost =
                row.dataCoverage === "COMPLETE" && row.standardUnitCostSnapshot
                  ? row.varianceQuantity
                      .abs()
                      .times(row.standardUnitCostSnapshot)
                      .toDecimalPlaces(2)
                      .toFixed(2)
                  : null;
              return (
                <tr key={row.id} className="border-b">
                  <td className="p-3">
                    {row.session.approvedAt
                      ? dateTime.format(row.session.approvedAt)
                      : "—"}
                  </td>
                  <td className="p-3 font-semibold">
                    {row.product?.name ?? row.supply?.name ?? "Unknown item"}
                    <span className="block text-xs font-normal text-muted-foreground">
                      {row.canonicalUnit.toLowerCase()}
                    </span>
                    {row.session.reason ? (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {row.session.reason}
                      </span>
                    ) : null}
                  </td>
                  <td className="p-3">{row.expectedQuantity.toString()}</td>
                  <td className="p-3">{row.physicalQuantity.toString()}</td>
                  <td
                    className={`p-3 font-semibold ${short ? "text-red-700" : "text-emerald-700"}`}
                  >
                    {short ? "Short" : "Extra"}{" "}
                    {row.varianceQuantity.abs().toString()}
                  </td>
                  {showCost ? (
                    <td className="p-3">
                      {cost === null ? "Cost unavailable" : `$${cost}`}
                    </td>
                  ) : null}
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={showCost ? 6 : 5} className="p-6">
                  No approved count differences for this window.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
      {totalPages > 1 ? (
        <nav
          className="flex items-center justify-between gap-4 text-sm"
          aria-label="Variance pages"
        >
          {page > 1 ? (
            <Link className="underline" href={link(page - 1)}>
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span>
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link className="underline" href={link(page + 1)}>
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Estimated cost uses the unit cost saved with each count and appears only
        when cost coverage was complete. Counts explain quantity differences;
        they do not identify the cause of missing stock.
      </p>
    </main>
  );
}
