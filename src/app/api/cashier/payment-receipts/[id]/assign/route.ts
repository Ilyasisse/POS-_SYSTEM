import { NextResponse } from "next/server";
import {
  canTakePayment,
  currentPaymentReceiptUser,
} from "@/lib/payments/payment-receipt-route-auth";
import { assignMobileMoneyReceipt } from "@/lib/payments/mobile-money-receipts";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await currentPaymentReceiptUser();
  if (!user || !canTakePayment(user)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const [{ id }, body] = await Promise.all([
      context.params,
      request.json() as Promise<Record<string, unknown>>,
    ]);
    const result = await assignMobileMoneyReceipt({
      receiptId: id,
      paymentRequestId: String(body.paymentRequestId ?? "").trim(),
      cashier: user,
    });
    return NextResponse.json({
      ok: true,
      status: result.request.status,
      paidAmount: result.paidAmount,
      remainingAmount: result.remainingAmount,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The receipt could not be assigned.",
      },
      { status: 400 },
    );
  }
}
