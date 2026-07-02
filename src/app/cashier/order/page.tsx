import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import CashierOrderClient from "@/components/cashier/CashierOrderClient";
import { Button } from "@/components/ui/button";

type CashierOrderPageProps = {
  searchParams?: Promise<{
    tableId?: string;
  }>;
};

export default async function CashierOrderPage({
  searchParams,
}: CashierOrderPageProps) {
  const [currentUser, params, tables] = await Promise.all([
    requirePermission(PERMISSIONS.ORDER_CREATE),
    searchParams,
    prisma.table.findMany({
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
    }),
  ]);

  return (
    <div className="min-h-screen bg-muted/35 px-4 py-6 text-foreground md:px-6">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Cashier table order</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Welcome {currentUser.fullName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/cashier">Back to cashier</Link>
            </Button>
          </div>
        </div>

        <CashierOrderClient
          tables={tables}
          initialTableId={params?.tableId ?? ""}
        />
      </div>
    </div>
  );
}
