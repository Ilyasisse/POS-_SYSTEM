import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { PaymentMethod } from "@prisma/client";
import { matchPaymentRequest } from "@/lib/payments/cashier-payment-requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.MACRODROID_PAYMENT_WEBHOOK_SECRET?.trim();
  const supplied =
    request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim() || request.headers.get("x-webhook-secret")?.trim();
  if (!secret || !supplied) return false;
  const left = Buffer.from(secret);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  if (!authorized(request))
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const body = await request.json();
    const result = await matchPaymentRequest({
      paymentRequestId: String(body.paymentRequestId ?? "").trim() || undefined,
      payerPhone: String(body.payerPhone ?? "").trim() || undefined,
      provider: String(body.provider ?? "").trim() as PaymentMethod,
      reference: String(body.reference ?? "").trim(),
      amount: Number(body.amount),
      sender: String(body.sender ?? ""),
      rawMessage: String(body.message ?? ""),
      paidAt: body.receivedAt ? new Date(String(body.receivedAt)) : undefined,
    });
    return NextResponse.json({
      ok: true,
      duplicate: result.duplicate,
      paymentRequestId: result.request.id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Payment callback failed.",
      },
      { status: 400 },
    );
  }
}
