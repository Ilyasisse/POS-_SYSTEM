import CashierOrderExperience from "@/components/cashier/CashierOrderExperience";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { canWaiterUseTable } from "@/lib/orders/table-order-access";

export default async function WaiterOrderPage() {
  const worker = await requirePermission(PERMISSIONS.ORDER_CREATE);
  const activeTables = await prisma.table.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      orders: {
        where: { status: "OPEN", type: "DINE_IN" },
        select: { waiterId: true },
      },
    },
    orderBy: { name: "asc" },
  });
  const tables = activeTables
    .filter((table) => canWaiterUseTable(worker.id, table.orders))
    .map(({ id, name }) => ({ id, name }));

  return <CashierOrderExperience tables={tables} />;
}
