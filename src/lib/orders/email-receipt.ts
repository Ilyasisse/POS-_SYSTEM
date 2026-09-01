import "server-only";

import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import {
  renderReceiptEmailHtml,
  type ReceiptEmailSnapshot,
} from "@/lib/orders/receipt-email-renderer";

export type EmailReceiptResult =
  | { status: "sent"; providerMessageId: string | null }
  | { status: "configuration_missing" };

async function recordDeliveryAudit(input: {
  actorUserId: string;
  orderId: string;
  recipient: string;
  status: "sent" | "configuration_missing" | "failed";
  providerMessageId?: string | null;
  reason?: string;
}) {
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: `order.receipt.email.${input.status}`,
      entityType: "Order",
      entityId: input.orderId,
      reason: input.reason,
      newValue: {
        recipient: input.recipient,
        providerMessageId: input.providerMessageId ?? null,
      },
    },
  });
}

export async function emailOrderReceipt(input: {
  orderId: string;
  recipient: string;
  actorUserId: string;
}): Promise<EmailReceiptResult> {
  const [order, settings] = await Promise.all([
    prisma.order.findUnique({
      where: { id: input.orderId },
      include: {
        table: { select: { name: true } },
        orderItems: {
          include: { modifiers: true },
          orderBy: { createdAt: "asc" },
        },
        payments: { orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.cafeSetting.findUnique({ where: { id: "default" } }),
  ]);

  if (!order) throw new Error("Order not found.");
  if (order.status !== "PAID" || !order.closedAt) {
    throw new Error("Only completed orders can be emailed as receipts.");
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RECEIPT_EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    await recordDeliveryAudit({
      actorUserId: input.actorUserId,
      orderId: order.id,
      recipient: input.recipient,
      status: "configuration_missing",
      reason: "RESEND_API_KEY or RECEIPT_EMAIL_FROM is not configured.",
    });
    return { status: "configuration_missing" };
  }

  const receipt: ReceiptEmailSnapshot = {
    businessName: settings?.businessName ?? "Mash Allah Cafe",
    currencyCode: settings?.currencyCode ?? "USD",
    orderNumber: order.orderNumber,
    orderType: order.type,
    tableName: order.table?.name ?? null,
    completedAt: order.closedAt,
    total: Number(order.total),
    lines: order.orderItems.map((line) => ({
      productName: line.productName,
      qty: line.qty,
      lineTotal: Number(line.lineTotal),
      modifiers: line.modifiers.map((modifier) => ({
        modifierName: modifier.modifierName,
        qty: modifier.qty,
      })),
    })),
    payments: order.payments.map((payment) => ({
      method: payment.method,
      amountPaid: Number(payment.amountPaid),
      reference: payment.reference,
    })),
  };

  try {
    const delivery = await new Resend(apiKey).emails.send({
      from,
      to: input.recipient,
      subject: `${receipt.businessName} receipt #${receipt.orderNumber}`,
      html: renderReceiptEmailHtml(receipt),
    });
    if (delivery.error) throw delivery.error;

    const providerMessageId = delivery.data?.id ?? null;
    await recordDeliveryAudit({
      actorUserId: input.actorUserId,
      orderId: order.id,
      recipient: input.recipient,
      status: "sent",
      providerMessageId,
    });
    return { status: "sent", providerMessageId };
  } catch (error) {
    await recordDeliveryAudit({
      actorUserId: input.actorUserId,
      orderId: order.id,
      recipient: input.recipient,
      status: "failed",
      reason:
        error instanceof Error
          ? error.message.slice(0, 250)
          : "Email provider rejected the receipt.",
    });
    throw error;
  }
}
