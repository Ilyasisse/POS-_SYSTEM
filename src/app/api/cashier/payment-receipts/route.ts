import { NextResponse } from "next/server";
import {
  canManagePaymentReceipts,
  canTakePayment,
  currentPaymentReceiptUser,
} from "@/lib/payments/payment-receipt-route-auth";
import { listMobileMoneyReceipts } from "@/lib/payments/mobile-money-receipts";

export const dynamic = "force-dynamic";

function receiptDto(
  receipt: Awaited<ReturnType<typeof listMobileMoneyReceipts>>[number],
) {
  return {
    id: receipt.id,
    provider: receipt.providerLabel ?? "SAHAL",
    reference: receipt.providerReference,
    direction: receipt.direction,
    status: receipt.status,
    amount: receipt.amount ? Number(receipt.amount) : null,
    currency: receipt.currency,
    counterpartyLabel: receipt.counterpartyLabel,
    counterpartyIdentifiers: Array.isArray(receipt.counterpartyIdentifiers)
      ? receipt.counterpartyIdentifiers
      : [],
    transactionAt: receipt.transactionAt?.toISOString() ?? null,
    providerBalance: receipt.providerBalance
      ? Number(receipt.providerBalance)
      : null,
    receivedAt: receipt.receivedAt.toISOString(),
    parseError: receipt.parseError,
    rawMessage: receipt.rawMessage,
    assignedAt: receipt.assignedAt?.toISOString() ?? null,
    assignedByName: receipt.assignedByName,
    assignment: receipt.paymentRequest
      ? {
          paymentRequestId: receipt.paymentRequest.id,
          payerName: receipt.paymentRequest.payerName,
          payerPhone: receipt.paymentRequest.payerPhone,
          expectedAmount: Number(receipt.paymentRequest.expectedAmount),
          table: receipt.paymentRequest.table,
        }
      : null,
  };
}

export async function GET() {
  const user = await currentPaymentReceiptUser();
  if (!user || (!canTakePayment(user) && !canManagePaymentReceipts(user))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const receipts = await listMobileMoneyReceipts();
  return NextResponse.json({
    ok: true,
    canManage: canManagePaymentReceipts(user),
    receipts: receipts.map(receiptDto),
  });
}
