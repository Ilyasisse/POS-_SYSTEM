import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentPaymentReceiptUser } from "@/lib/payments/payment-receipt-route-auth";
import {
  MACRODROID_GATEWAY_ID,
  resolveMacrodroidSecret,
} from "@/lib/payments/macrodroid-auth";

export const dynamic = "force-dynamic";
const STALE_AFTER_MS = 150_000;

export async function GET() {
  const user = await currentPaymentReceiptUser();
  if (!user || !["CASHIER", "MANAGER", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const configured = Boolean(resolveMacrodroidSecret());
  const gateway = await prisma.paymentGatewayStatus.findUnique({
    where: { id: MACRODROID_GATEWAY_ID },
  });
  const ageMs = gateway
    ? Math.max(0, Date.now() - gateway.lastHeartbeatAt.getTime())
    : null;
  return NextResponse.json({
    ok: true,
    configured,
    online: configured && ageMs !== null && ageMs <= STALE_AFTER_MS,
    lastHeartbeatAt: gateway?.lastHeartbeatAt.toISOString() ?? null,
    lastReceiptAt: gateway?.lastReceiptAt?.toISOString() ?? null,
    staleAfterSeconds: STALE_AFTER_MS / 1000,
  });
}
