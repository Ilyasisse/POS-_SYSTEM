import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeApi } from "@/lib/auth/api-authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  expireCustomerCheckout,
  finalizeCustomerCheckout,
} from "@/lib/payments/customer-checkout";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeApi(PERMISSIONS.CUSTOMER_ORDER);
  if (!authorization.ok) return authorization.response;
  if (authorization.user.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const { id } = await params;
  let checkout = await prisma.customerCheckout.findFirst({
    where: { id, customerId: authorization.user.id },
    include: { order: { select: { orderNumber: true } } },
  });
  if (!checkout) return NextResponse.json({ error: "Checkout not found." }, { status: 404 });
  await expireCustomerCheckout(checkout.id);
  if (checkout.status === "PAYMENT_RECEIVED") {
    await finalizeCustomerCheckout(checkout.id);
  }
  checkout = await prisma.customerCheckout.findFirst({
    where: { id, customerId: authorization.user.id },
    include: { order: { select: { orderNumber: true } } },
  });
  if (!checkout) return NextResponse.json({ error: "Checkout not found." }, { status: 404 });
  return NextResponse.json({
    checkout: {
      id: checkout.id,
      amount: Number(checkout.amount),
      payerPhone: checkout.payerPhone,
      status: checkout.status,
      expiresAt: checkout.expiresAt.toISOString(),
      orderNumber: checkout.order?.orderNumber ?? null,
      paymentReceived: Boolean(checkout.receiptId),
    },
  }, { headers: { "Cache-Control": "private, no-store" } });
}
