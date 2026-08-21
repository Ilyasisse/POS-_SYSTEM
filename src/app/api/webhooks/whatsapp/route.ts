import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  extractTwilioStatusUpdate,
  shouldApplyWhatsAppStatus,
  verifyTwilioSignature,
} from "@/lib/supplier-orders/whatsapp";

export const runtime = "nodejs";

function expectedWebhookUrl() {
  const appBaseUrl = process.env.APP_BASE_URL?.trim();
  if (!appBaseUrl) return null;
  try {
    return `${new URL(appBaseUrl).origin}/api/webhooks/whatsapp`;
  } catch {
    return null;
  }
}

function formParams(formData: FormData) {
  const params: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") params[key] = value;
  }
  return params;
}

export async function POST(request: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const url = expectedWebhookUrl();
  if (!authToken || !url) {
    return NextResponse.json(
      { error: "Twilio webhook configuration is incomplete." },
      { status: 503 },
    );
  }

  const params = formParams(await request.formData());
  if (
    !verifyTwilioSignature({
      authToken,
      signatureHeader: request.headers.get("x-twilio-signature"),
      url,
      params,
    })
  ) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const update = extractTwilioStatusUpdate(params);
  if (!update) return NextResponse.json({ ok: true });
  const delivery = await prisma.supplierOrderWhatsAppDelivery.findFirst({
    where: { provider: "TWILIO", providerMessageId: update.messageId },
    select: {
      id: true,
      status: true,
      type: true,
      runId: true,
      deliveredAt: true,
    },
  });
  if (!delivery) return NextResponse.json({ ok: true });

  const nextStatus =
    update.status === "failed"
      ? "FAILED"
      : update.status === "delivered"
        ? "DELIVERED"
        : update.status === "read"
          ? "READ"
          : "ACCEPTED";
  if (!shouldApplyWhatsAppStatus(delivery.status, nextStatus)) {
    return NextResponse.json({ ok: true });
  }

  const now = new Date();
  const errorMessage = update.error ?? "Twilio reported delivery failure.";
  await prisma.$transaction([
    prisma.supplierOrderWhatsAppDelivery.update({
      where: { id: delivery.id },
      data: {
        status: nextStatus,
        deliveredAt:
          nextStatus === "DELIVERED" || nextStatus === "READ"
            ? (delivery.deliveredAt ?? now)
            : undefined,
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
  return NextResponse.json({ ok: true });
}
