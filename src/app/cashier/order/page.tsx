import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import CashierOrderExperience from "@/components/cashier/CashierOrderExperience";

type CashierOrderPageProps = {
  searchParams?: Promise<{
    tableId?: string;
  }>;
};

export default async function CashierOrderPage({
  searchParams,
}: CashierOrderPageProps) {
  const params = await searchParams;
  const requestedTableId = params?.tableId?.trim() ?? "";
  const [, tables] = await Promise.all([
    requirePermission(PERMISSIONS.ORDER_CREATE),
    prisma.table.findMany({
      where: {
        isActive: true,
        OR: [
          {
            orders: {
              none: {
                status: "OPEN",
                type: "DINE_IN",
              },
            },
          },
          ...(requestedTableId ? [{ id: requestedTableId }] : []),
        ],
      },
      select: {
        id: true,
        name: true,
        orders: {
          where: { status: "OPEN", type: "DINE_IN" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            tableCheck: { select: { guestCount: true } },
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    }),
  ]);

  return (
    <CashierOrderExperience
      tables={tables.map((table) => ({
        id: table.id,
        name: table.name,
        guestCount: table.orders[0]?.tableCheck?.guestCount ?? 1,
      }))}
      initialTableId={requestedTableId}
    />
  );
}
