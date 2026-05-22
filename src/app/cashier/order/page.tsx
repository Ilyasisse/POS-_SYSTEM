import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/requireRole";
import CashierOrderClient from "./CashierOrderClient";

type CashierOrderPageProps = {
  searchParams?: Promise<{
    tableId?: string;
  }>;
};

export default async function CashierOrderPage({
  searchParams,
}: CashierOrderPageProps) {
  const currentUser = await requireRole(["CASHIER", "ADMIN"]);
  const params = await searchParams;
  const tables = await prisma.table.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return (
    <main className="min-h-screen bg-linear-to-br from-slate-100 via-blue-50 to-blue-100 px-4 py-6 text-slate-900 md:px-6">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Cashier table order</h1>
            <p className="mt-1 text-sm text-slate-600">
              Welcome {currentUser.fullName}
            </p>
          </div>
          <Link
            href="/cashier"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to cashier
          </Link>
        </div>

        {tables.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">
              Add a table first
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              There are no active tables available for this order. Add active
              tables from the Admin tables page before sending orders.
            </p>
            <Link
              href="/admin/tables"
              className="mt-5 inline-flex rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Go to Admin tables
            </Link>
          </section>
        ) : (
          <CashierOrderClient
            tables={tables}
            initialTableId={params?.tableId ?? ""}
          />
        )}
      </div>
    </main>
  );
}
