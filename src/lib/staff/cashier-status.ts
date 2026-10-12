import "server-only";
import { prisma } from "@/lib/prisma";

export async function getCashierStatusSnapshot() {
  const [cashiers, history, unassigned] = await Promise.all([
    prisma.staff.findMany({
      where: { role: "CASHIER" },
      select: {
        id: true,
        fullName: true,
        isActive: true,
        availability: true,
        lastSeenAt: true,
      },
      orderBy: { fullName: "asc" },
    }),
    prisma.auditLog.findMany({
      where: { action: "staff.availability_changed" },
      include: { actor: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.order.findMany({
      where: {
        customerCheckout: { is: { status: "PAID" } },
        waiterId: null,
        cashierId: null,
        kitchenTicketState: { is: { pickupStatus: { not: "DELIVERED" } } },
      },
      select: { id: true, orderNumber: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return { cashiers, history, unassigned, observedAt: Date.now() };
}
