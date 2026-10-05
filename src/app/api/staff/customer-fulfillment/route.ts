import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeApi } from "@/lib/auth/api-authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { customerOrderStage } from "@/lib/customer/customer-order-progress";
import { customerFulfillmentDestination } from "@/lib/customer/customer-order-fulfillment";
import { KitchenTicketMutationError, updateKitchenTicketPickup } from "@/lib/kitchen/kitchen-tickets";
export const dynamic = "force-dynamic";
export async function GET() {
  const auth = await authorizeApi(PERMISSIONS.ORDER_MANAGE);
  if (!auth.ok) return auth.response;
  const orders = await prisma.order.findMany({
    where: { customerCheckout: { is: { status: "PAID" } }, kitchenTicketState: { is: { pickupStatus: { not: "DELIVERED" } } } },
    include: { table: { select: { name: true } }, customerCheckout: { select: { customerName: true } }, kitchenTicketState: { include: { stationStates: true } } },
    orderBy: { createdAt: "asc" }, take: 100,
  });
  return NextResponse.json({ orders: orders.map(order => ({
    id: order.id, orderNumber: order.orderNumber, customerName: order.customerCheckout?.customerName,
    destination: customerFulfillmentDestination({ orderType: order.type, tableName: order.table?.name, deliveryAddress: order.deliveryAddress }),
    deliveryPhone: order.type === "DELIVERY" ? order.deliveryPhone : null,
    stage: customerOrderStage("PAID", order.kitchenTicketState),
  })) }, { headers: { "Cache-Control": "private, no-store" } });
}
export async function PATCH(request: Request) {
  const auth = await authorizeApi(PERMISSIONS.ORDER_MANAGE);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => null) as { orderId?: string; status?: string } | null;
  if (!body || typeof body.orderId !== "string" || (body.status !== "claimed" && body.status !== "delivered")) return NextResponse.json({ error: "Select an order and valid pickup status." }, { status: 400 });
  const order = await prisma.order.findFirst({
    where: { id: body.orderId, customerCheckout: { is: { status: "PAID" } } },
    select: { id: true },
  });
  if (!order) return NextResponse.json({ error: "Paid customer order not found." }, { status: 404 });
  try {
    await updateKitchenTicketPickup({ orderId: order.id, pickupStatus: body.status, viewer: auth.user });
    return NextResponse.json({ ok: true });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Could not update pickup." },
      { status: cause instanceof KitchenTicketMutationError ? cause.status : 500 });
  }
}
