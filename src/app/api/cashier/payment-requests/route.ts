import { NextResponse } from "next/server";
import { type PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { createPaymentRequestBatch } from "@/lib/payments/cashier-payment-requests";

const METHODS = new Set<PaymentMethod>([
  "MYCASH",
  "GOLIS",
  "Dahabshiil",
  "OTHER",
]);

async function currentCashier() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const cashier = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, fullName: true, role: true, isActive: true },
  });
  return cashier?.isActive && hasPermission(cashier, PERMISSIONS.PAYMENT_TAKE)
    ? cashier
    : null;
}

export async function POST(request: Request) {
  const cashier = await currentCashier();
  if (!cashier)
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const body = await request.json();
    const method = String(body.method ?? "") as PaymentMethod;
    if (!METHODS.has(method))
      return NextResponse.json(
        { error: "Select a payment method." },
        { status: 400 },
      );
    const requests = await createPaymentRequestBatch({
      batchKey: String(body.batchKey ?? "").trim(),
      tableId: String(body.tableId ?? "").trim(),
      cashier,
      method,
      payLater: body.payLater === true,
      lines: Array.isArray(body.lines)
        ? body.lines.map((line: Record<string, unknown>) => ({
            payerName: String(line.payerName ?? ""),
            payerPhone: String(line.payerPhone ?? ""),
            amount: Number(line.amount),
          }))
        : [],
    });
    return NextResponse.json({
      ok: true,
      batchKey: requests[0]?.batchKey,
      requests: requests.map((item) => ({
        id: item.id,
        payerName: item.payerName,
        payerPhone: item.payerPhone,
        amount: Number(item.expectedAmount),
        status: item.status,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not start payment checks.",
      },
      { status: 400 },
    );
  }
}

export async function GET(request: Request) {
  const cashier = await currentCashier();
  if (!cashier)
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const batchKey = new URL(request.url).searchParams.get("batchKey")?.trim();
  if (!batchKey)
    return NextResponse.json(
      { error: "batchKey is required." },
      { status: 400 },
    );
  const requests = await prisma.paymentRequest.findMany({
    where: { batchKey, cashierId: cashier.id },
    orderBy: { lineIndex: "asc" },
    include: { payments: { select: { amountPaid: true } } },
  });
  return NextResponse.json({
    ok: true,
    requests: requests.map((item) => {
      const paidAmount = item.payments.reduce(
        (sum, payment) => sum + Number(payment.amountPaid),
        0,
      );
      return {
        id: item.id,
        payerName: item.payerName,
        payerPhone: item.payerPhone,
        amount: Number(item.expectedAmount),
        paidAmount,
        remainingAmount: Math.max(0, Number(item.expectedAmount) - paidAmount),
        status: item.status,
        reference: item.providerReference,
      };
    }),
  });
}
