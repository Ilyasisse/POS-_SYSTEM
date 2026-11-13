import Link from "next/link";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

export default async function CustomerPreferencesPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; customer?: string }>;
}) {
  await requirePermission(PERMISSIONS.REPORT_CUSTOMER_VIEW);
  const params = (await searchParams) ?? {};
  const q = (params.q ?? "").trim().slice(0, 100);
  const customerId = params.customer ?? "";
  const [customers, customer] = await Promise.all([
    q.length >= 2
      ? prisma.customer.findMany({
          where: {
            OR: [
              { fullName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { phoneNumber: { contains: q } },
            ],
          },
          select: { id: true, fullName: true, email: true, phoneNumber: true },
          orderBy: { fullName: "asc" },
          take: 20,
        })
      : Promise.resolve([]),
    customerId
      ? prisma.customer.findUnique({
          where: { id: customerId },
          select: { id: true, fullName: true, email: true },
        })
      : Promise.resolve(null),
  ]);

  const groups = customer
    ? await prisma.orderItem.groupBy({
        by: ["productId"],
        where: { order: { customerId: customer.id, status: "PAID" } },
        _sum: { qty: true },
        _count: { id: true },
        orderBy: { _sum: { qty: "desc" } },
        take: 10,
      })
    : [];
  const products = groups.length
    ? await prisma.product.findMany({
        where: { id: { in: groups.map((group) => group.productId) } },
        select: { id: true, name: true },
      })
    : [];
  const names = new Map(products.map((product) => [product.id, product.name]));

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <header>
        <Link href="/admin/business-intelligence" className="text-sm underline">
          ← Business intelligence
        </Link>
        <h1 className="mt-3 text-2xl font-bold">
          Customer product preferences
        </h1>
        <p className="text-sm text-muted-foreground">
          Find a customer and review the products they ordered most often.
        </p>
      </header>
      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border bg-background p-4"
      >
        <label className="grid min-w-64 flex-1 gap-2 text-sm font-semibold">
          Customer name, phone, or email
          <Input
            name="q"
            defaultValue={q}
            minLength={2}
            maxLength={100}
            required
          />
        </label>
        <Button type="submit">Search</Button>
      </form>
      {q.length >= 2 ? (
        <section className="space-y-2">
          <h2 className="font-semibold">Matches (up to 20)</h2>
          {customers.length === 0 ? (
            <p className="text-sm">No customers found.</p>
          ) : null}
          <ul className="divide-y rounded-xl border bg-background px-4">
            {customers.map((match) => (
              <li key={match.id} className="py-3 text-sm">
                <Link
                  className="font-semibold underline"
                  href={`/admin/reports/customer-preferences?customer=${encodeURIComponent(match.id)}&q=${encodeURIComponent(q)}`}
                >
                  {match.fullName}
                </Link>
                <p className="text-muted-foreground">
                  {match.phoneNumber || match.email}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {customer ? (
        <section className="rounded-xl border bg-background p-5">
          <h2 className="text-lg font-semibold">
            {customer.fullName} · Most purchased products
          </h2>
          <p className="text-sm text-muted-foreground">{customer.email}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Counts include item quantities on linked paid orders. Anonymous
            orders, order cancellations, and unlinked purchases are excluded;
            later refunds are not subtracted.
          </p>
          {groups.length === 0 ? (
            <p className="mt-4 text-sm">No linked paid order items yet.</p>
          ) : null}
          <ol className="mt-4 divide-y">
            {groups.map((group, index) => (
              <li
                key={group.productId}
                className="flex justify-between gap-3 py-3 text-sm"
              >
                <span>
                  {index + 1}.{" "}
                  {names.get(group.productId) ?? "Archived product"}
                </span>
                <strong>{group._sum.qty ?? 0} ordered</strong>
              </li>
            ))}
          </ol>
        </section>
      ) : customerId ? (
        <p className="text-sm">The selected customer could not be found.</p>
      ) : null}
    </main>
  );
}
