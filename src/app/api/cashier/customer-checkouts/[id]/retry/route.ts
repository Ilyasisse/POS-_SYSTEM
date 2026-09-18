import { NextResponse } from "next/server";
import {
  canTakePayment,
  currentPaymentReceiptUser,
} from "@/lib/payments/payment-receipt-route-auth";
import { finalizeCustomerCheckout } from "@/lib/payments/customer-checkout";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentPaymentReceiptUser();
  if (!user || !canTakePayment(user)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id } = await params;
  const order = await finalizeCustomerCheckout(id);
  return NextResponse.json({ ok: Boolean(order) });
}
