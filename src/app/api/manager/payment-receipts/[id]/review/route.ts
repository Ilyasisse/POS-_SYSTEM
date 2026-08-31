import { NextResponse } from "next/server";
import { canManagePaymentReceipts, currentPaymentReceiptUser } from "@/lib/payments/payment-receipt-route-auth";
import { reviewMobileMoneyReceipt } from "@/lib/payments/mobile-money-receipts";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentPaymentReceiptUser();
  if (!user || !canManagePaymentReceipts(user)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const [{ id }, body] = await Promise.all([
      context.params,
      request.json() as Promise<Record<string, unknown>>,
    ]);
    const direction = String(body.direction ?? "").toUpperCase();
    if (direction !== "INCOMING" && direction !== "OUTGOING") {
      throw new Error("Direction must be INCOMING or OUTGOING.");
    }
    const identifiers = Array.isArray(body.counterpartyIdentifiers)
      ? body.counterpartyIdentifiers.map(String)
      : String(body.counterpartyIdentifiers ?? "").split(/[\s,]+/);
    await reviewMobileMoneyReceipt({
      receiptId: id,
      actor: user,
      reason: String(body.reason ?? ""),
      direction,
      providerReference: String(body.providerReference ?? ""),
      amount: Number(body.amount),
      counterpartyLabel: String(body.counterpartyLabel ?? ""),
      counterpartyIdentifiers: identifiers,
      transactionAt: new Date(String(body.transactionAt ?? "")),
      providerBalance: Number(body.providerBalance),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The receipt review could not be saved." },
      { status: 400 },
    );
  }
}
