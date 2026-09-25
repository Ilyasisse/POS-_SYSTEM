import { NextResponse } from "next/server";
import {
  canManagePaymentReceipts,
  currentPaymentReceiptUser,
} from "@/lib/payments/payment-receipt-route-auth";
import { reverseMobileMoneyReceipt } from "@/lib/payments/mobile-money-receipts";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await currentPaymentReceiptUser();
  if (!user || !canManagePaymentReceipts(user)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const [{ id }, body] = await Promise.all([
      context.params,
      request.json() as Promise<Record<string, unknown>>,
    ]);
    await reverseMobileMoneyReceipt({
      receiptId: id,
      actor: user,
      reason: String(body.reason ?? ""),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The assignment could not be reversed.",
      },
      { status: 400 },
    );
  }
}
