import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeApi } from "@/lib/auth/api-authorization";
import { retryCustomerCheckoutPayment } from "@/lib/payments/customer-checkout";
import { PERMISSIONS } from "@/lib/auth/permissions";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeApi(PERMISSIONS.CUSTOMER_ORDER);
  if (!authorization.ok) return authorization.response;
  if (authorization.user.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const { id } = await params;
  const result = await prisma.customerCheckout.updateMany({
    where: {
      id,
      customerId: authorization.user.id,
      status: { in: ["PENDING", "REVIEW"] },
      expiresAt: { gt: new Date() },
      receiptId: null,
    },
    data: { status: "REVIEW" },
  });
  if (result.count !== 1) {
    return NextResponse.json({ error: "This checkout can no longer request review." }, { status: 409 });
  }
  await retryCustomerCheckoutPayment(id);
  return NextResponse.json({ ok: true });
}
