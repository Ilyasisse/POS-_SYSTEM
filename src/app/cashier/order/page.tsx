import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/require-role";
import CashierOrderClient from "@/components/cashier/CashierOrderClient";

type CashierOrderPageProps = {
  searchParams?: Promise<{
    tableId?: string;
  }>;
};

const openTableFilter = {
  orders: {
    none: {
      status: "OPEN" as const,
      type: "DINE_IN" as const,
    },
  },
};

export default async function CashierOrderPage({
  searchParams,
}: CashierOrderPageProps) {
  const [currentUser, params] = await Promise.all([
    requireRole(["CASHIER", "ADMIN"]),
    searchParams,
  ]);
  const requestedTableId = params?.tableId?.trim() ?? "";
  const tables = await prisma.table.findMany({
    where: requestedTableId
      ? {
          isActive: true,
          OR: [{ id: requestedTableId }, openTableFilter],
        }
      : {
          isActive: true,
          ...openTableFilter,
        },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });
  const initialTableId = tables.some((table) => table.id === requestedTableId)
    ? requestedTableId
    : "";

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
          initialTableId={initialTableId}
          autoSelectFirstTable={!requestedTableId}
        />
      </div>
    </main>
  );
}
