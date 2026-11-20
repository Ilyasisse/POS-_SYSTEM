import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import WaiterPickupPage from "@/components/waiter/WaiterPickupPage";
import { prisma } from "@/lib/prisma";
import { getOutstandingOrderTotal } from "@/lib/waiter/assigned-orders";

export default async function Page() {
  const currentUser = await requirePermission(PERMISSIONS.ORDER_VIEW_ASSIGNED);
  const orders = await prisma.order.findMany({
    where: {
      waiterId: currentUser.id,
      OR: [
        { status: "OPEN" },
        {
          status: "PAID",
          customerCheckout: { is: { status: "PAID" } },
          kitchenTicketState: { is: { pickupStatus: { not: "DELIVERED" } } },
        },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      total: true,
      createdAt: true,
      table: { select: { name: true } },
      payments: { select: { amountPaid: true } },
      orderItems: {
        orderBy: { createdAt: "asc" },
        select: { id: true, productName: true, qty: true },
      },
    },
  });

  const assignedOrders = orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    tableName: order.table?.name ?? "Takeaway",
    createdAt: order.createdAt.toISOString(),
    isPaidCustomerOrder: order.status === "PAID",
    outstandingTotal: getOutstandingOrderTotal(
      Number(order.total),
      order.payments.map((payment) => ({
        amountPaid: Number(payment.amountPaid),
      })),
    ),
    items: order.orderItems.map((item) => ({
      id: item.id,
      name: item.productName,
      quantity: item.qty,
    })),
  }));

  return (
    <WaiterPickupPage
      currentUserId={currentUser.id}
      currentUserName={currentUser.fullName}
      currentUserRole={currentUser.role}
      assignedOrders={assignedOrders}
    />
  );
}
