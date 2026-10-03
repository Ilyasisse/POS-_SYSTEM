import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  canTakePayment,
  canManagePaymentReceipts,
  currentPaymentReceiptUser,
} from "@/lib/payments/payment-receipt-route-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await currentPaymentReceiptUser();
  if (!user || (!canTakePayment(user) && !canManagePaymentReceipts(user))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const page = (name: string) => { const value = Number(params.get(name) ?? 0); return Number.isInteger(value) && value >= 0 ? Math.min(value, 10_000) : 0; };
  const checkoutPage = page("checkoutPage");
  const receiptPage = page("receiptPage");
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
      skip: checkoutPage * 100,
      take: 101,
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
      skip: receiptPage * 100,
      take: 101,
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
      hasMoreCheckouts: checkouts.length > 100,
      hasMoreReceipts: receipts.length > 100,
      checkouts: checkouts.slice(0, 100).map((checkout) => ({
        ...checkout,
        amount: Number(checkout.amount),
      })),
      receipts: receipts.slice(0, 100).map((receipt) => ({
        ...receipt,
        amount: Number(receipt.amount),
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
