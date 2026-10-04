import { NextResponse } from "next/server";
import {
  canTakePayment,
  canManagePaymentReceipts,
  currentPaymentReceiptUser,
} from "@/lib/payments/payment-receipt-route-auth";
import { assignCustomerCheckoutReceipt } from "@/lib/payments/customer-checkout";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentPaymentReceiptUser();
  if (!user || (!canTakePayment(user) && !canManagePaymentReceipts(user))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id } = await params;
  const body = (await request.json()) as { receiptId?: string; reason?: string };
  if (typeof body.receiptId !== "string" || !body.receiptId.trim()) {
    return NextResponse.json({ error: "Select a receipt." }, { status: 400 });
  }
  try {
    await assignCustomerCheckoutReceipt({
      checkoutId: id,
      receiptId: body.receiptId,
      staff: { id: user.id, fullName: user.fullName },
      reviewReason: String(body.reason ?? ""),
      allowExceptions: canManagePaymentReceipts(user),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Receipt could not be assigned.",
      },
      { status: 409 },
    );
  }
}
