import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  extractWhatsAppStatusUpdates,
  verifyWhatsAppSignature,
} from "@/lib/supplier-orders/whatsapp";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (
    mode === "subscribe" &&
    token &&
    challenge &&
    token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  ) {
    return new Response(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Webhook verification failed." }, { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();
  if (
    !appSecret ||
    !verifyWhatsAppSignature(
      rawBody,
      request.headers.get("x-hub-signature-256"),
      appSecret,
    )
  ) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  for (const update of extractWhatsAppStatusUpdates(payload)) {
    const delivery = await prisma.supplierOrderWhatsAppDelivery.findUnique({
      where: { metaMessageId: update.messageId },
      select: { id: true, status: true, type: true, runId: true },
    });
    if (!delivery) continue;
    const rank = { PENDING: 0, FAILED: 0, ACCEPTED: 1, DELIVERED: 2, READ: 3 };
    const nextStatus =
      update.status === "failed"
        ? "FAILED"
        : update.status === "delivered"
          ? "DELIVERED"
          : update.status === "read"
            ? "READ"
            : "ACCEPTED";
    if (nextStatus !== "FAILED" && rank[nextStatus] < rank[delivery.status]) continue;
    const now = new Date();
    const errorMessage = update.error ?? "WhatsApp reported delivery failure.";
    await prisma.$transaction([
      prisma.supplierOrderWhatsAppDelivery.update({
        where: { id: delivery.id },
        data: {
          status: nextStatus,
          deliveredAt: nextStatus === "DELIVERED" ? now : undefined,
          readAt: nextStatus === "READ" ? now : undefined,
          failedAt: nextStatus === "FAILED" ? now : undefined,
          errorMessage: nextStatus === "FAILED" ? errorMessage : null,
        },
      }),
      ...(delivery.type === "SUPPLIER_ORDER" && nextStatus === "FAILED"
        ? [
            prisma.supplierOrderRun.update({
              where: { id: delivery.runId },
              data: { status: "FAILED", failureReason: errorMessage },
            }),
          ]
        : delivery.type === "SUPPLIER_ORDER" &&
            (nextStatus === "DELIVERED" || nextStatus === "READ")
          ? [
              prisma.supplierOrderRun.update({
                where: { id: delivery.runId },
                data: { status: "SENT", failureReason: null },
              }),
            ]
          : []),
    ]);
  }
  return NextResponse.json({ ok: true });
}
