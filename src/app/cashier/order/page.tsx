import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import CashierOrderClient from "@/components/cashier/CashierOrderClient";

type CashierOrderPageProps = {
  searchParams?: Promise<{
    tableId?: string;
  }>;
};

export default async function CashierOrderPage({
  searchParams,
}: CashierOrderPageProps) {
  const currentUser = await requirePermission(PERMISSIONS.ORDER_CREATE);
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

        <CashierOrderClient
          tables={tables}
          initialTableId={params?.tableId ?? ""}
        />
      </div>
    </main>
  );
}
