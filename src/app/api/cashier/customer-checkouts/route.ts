import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  canTakePayment,
  canManagePaymentReceipts,
  currentPaymentReceiptUser,
} from "@/lib/payments/payment-receipt-route-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentPaymentReceiptUser();
  if (!user || (!canTakePayment(user) && !canManagePaymentReceipts(user))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const [checkouts, receipts] = await Promise.all([
    prisma.customerCheckout.findMany({
      where: {
        status: {
          in: [
            "PENDING",
            "REVIEW",
            "EXPIRED",
            "PAYMENT_RECEIVED",
            "NEEDS_HELP",
          ],
        },

      },
      orderBy: { createdAt: "asc" },
      take: 100,
      select: {
        id: true,
        customerName: true,
        payerPhone: true,
        amount: true,
        status: true,
        receiptId: true,
        createdAt: true,
        expiresAt: true,
      },
    }),
    prisma.mobileMoneyReceipt.findMany({
      where: {
        status: "AVAILABLE",
        direction: "INCOMING",
        method: "GOLIS",
        amount: { not: null },
        assignedPaymentRequestId: null,
      },
      orderBy: { receivedAt: "asc" },
      take: 100,
      select: {
        id: true,
        amount: true,
        providerReference: true,
        counterpartyLabel: true,
        counterpartyIdentifiers: true,
        rawMessage: true,
        transactionAt: true,
      },
    }),
  ]);
  return NextResponse.json(
    {
      canManage: canManagePaymentReceipts(user),
      checkouts: checkouts.map((checkout) => ({
        ...checkout,
        amount: Number(checkout.amount),
      })),
      receipts: receipts.map((receipt) => ({
        ...receipt,
        amount: Number(receipt.amount),
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
