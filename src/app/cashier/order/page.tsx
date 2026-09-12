import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import CashierOrderExperience from "@/components/cashier/CashierOrderExperience";

type CashierOrderPageProps = {
  searchParams?: Promise<{
    tableId?: string;
    repeatOrderId?: string;
  }>;
};

export default async function CashierOrderPage({
  searchParams,
}: CashierOrderPageProps) {
  const params = await searchParams;
  const requestedTableId = params?.tableId?.trim() ?? "";
  const repeatOrderId = params?.repeatOrderId?.trim() ?? "";
  const [, tables, repeatOrder] = await Promise.all([
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
      },
      orderBy: {
        name: "asc",
      },
    }),
    requestedTableId && repeatOrderId
      ? prisma.order.findFirst({
          where: {
            id: repeatOrderId,
            tableId: requestedTableId,
            type: "DINE_IN",
          },
          select: {
            id: true,
            orderNumber: true,
            tableCheckRound: true,
            orderItems: {
              orderBy: { createdAt: "asc" },
              select: {
                productId: true,
                qty: true,
                assignedUserId: true,
                modifiers: {
                  select: { modifierId: true, qty: true },
                },
              },
            },
          },
        })
      : Promise.resolve(null),
  ]);

  return (
    <CashierOrderExperience
      tables={tables}
      initialTableId={requestedTableId}
      repeatOrder={repeatOrder ?? undefined}
    />
  );
}
