import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
export const dynamic = "force-dynamic";
export async function GET() {
  const user = await getCurrentUser();
  if (!user?.isActive || !["CASHIER", "WAITER", "ADMIN", "MANAGER"].includes(user.role)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  if (user.role === "ADMIN" || user.role === "MANAGER") {
    const [checkouts, receipts] = await Promise.all([
      prisma.customerCheckout.count({ where: { status: { in: ["REVIEW", "NEEDS_HELP"] } } }),
      prisma.mobileMoneyReceipt.count({ where: { OR: [
        { status: "AVAILABLE", direction: "INCOMING", assignedPaymentRequestId: null },
        { status: "NEEDS_REVIEW" },
      ] } }),
    ]);
    return NextResponse.json({ notifications: [], paymentReview: { checkouts, receipts } }, { headers: { "Cache-Control": "private, no-store" } });
  }
  const notifications = await prisma.auditLog.findMany({
    where: { action: "customer_order.assigned", entityType: "Staff", entityId: user.id, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) } },
    orderBy: { createdAt: "desc" }, take: 10,
    select: { id: true, newValue: true, relatedEntityId: true },
  });
  const orders = await prisma.order.findMany({
    where: { id: { in: notifications.flatMap(item => item.relatedEntityId ? [item.relatedEntityId] : []) }, kitchenTicketState: { is: { pickupStatus: { not: "DELIVERED" } } } },
    select: { id: true },
  });
  const ids = new Set(orders.map(order => order.id));
  return NextResponse.json({ notifications: notifications.filter(item => item.relatedEntityId && ids.has(item.relatedEntityId)) }, { headers: { "Cache-Control": "private, no-store" } });
}
