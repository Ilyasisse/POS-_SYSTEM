import { Prisma } from "@prisma/client";
import twilio from "twilio";
import { prisma } from "@/lib/prisma";
import {
  formatInventoryWhatsAppDigest,
  inventoryDigestDate,
  type LowStockDigestItem,
} from "./whatsapp-digest";

function required(key: string) {
  const value = process.env[key]?.trim();
  if (!value)
    throw new Error(`${key} is required for the inventory WhatsApp digest.`);
  return value;
}

function address(value: string) {
  return value.startsWith("whatsapp:") ? value : `whatsapp:${value}`;
}

export async function sendInventoryWhatsAppDigest(now = new Date()) {
  if (
    process.env.TWILIO_WHATSAPP_ENABLED?.toLowerCase() !== "true" ||
    process.env.INVENTORY_ALERT_WHATSAPP_ENABLED?.toLowerCase() !== "true"
  ) {
    return { skipped: "disabled" as const };
  }

  // Validate configuration before taking a once-per-day delivery claim.
  const accountSid = required("TWILIO_ACCOUNT_SID");
  const apiKeySid = required("TWILIO_API_KEY_SID");
  const apiKeySecret = required("TWILIO_API_KEY_SECRET");
  const from = address(required("TWILIO_WHATSAPP_FROM"));
  const to = address(required("INVENTORY_ALERT_WHATSAPP_TO"));
  const contentSid = required("TWILIO_INVENTORY_ALERT_CONTENT_SID");

  const [supplies, products] = await Promise.all([
    prisma.inventorySupply.findMany({
      where: { isActive: true },
      select: {
        name: true,
        stockQty: true,
        lowStockThreshold: true,
        unit: true,
      },
    }),
    prisma.product.findMany({
      where: { isActive: true, trackStock: true },
      select: {
        name: true,
        stockQty: true,
        lowStockThreshold: true,
        canonicalUnit: true,
      },
    }),
  ]);

  const items: LowStockDigestItem[] = [
    ...supplies.map((item) => ({ ...item, kind: "Supply" as const })),
    ...products.map((item) => ({
      ...item,
      kind: "Product" as const,
      unit: item.canonicalUnit.toLowerCase(),
    })),
  ]
    .filter(
      (item) =>
        item.stockQty.lte(0) ||
        (item.lowStockThreshold.gt(0) &&
          item.stockQty.lte(item.lowStockThreshold)),
    )
    .map((item) => ({
      name: item.name,
      kind: item.kind,
      quantity: item.stockQty.toString(),
      threshold: item.lowStockThreshold.toString(),
      unit: item.unit,
    }))
    .sort((left, right) => {
      const leftOut = Number(left.quantity) <= 0;
      const rightOut = Number(right.quantity) <= 0;
      return (
        Number(rightOut) - Number(leftOut) ||
        left.name.localeCompare(right.name)
      );
    });

  const date = inventoryDigestDate(now);
  const summary = formatInventoryWhatsAppDigest(items, date);
  if (!summary) return { skipped: "no_low_stock" as const };

  const digestDate = new Date(`${date}T00:00:00.000Z`);
  try {
    await prisma.inventoryWhatsAppDigest.create({
      data: { digestDate, summary },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { skipped: "already_claimed" as const, date };
    }
    throw error;
  }

  try {
    const client = twilio(apiKeySid, apiKeySecret, { accountSid });
    const sent = await client.messages.create({
      from,
      to,
      contentSid,
      contentVariables: JSON.stringify({ "1": summary }),
    });
    if (!sent.sid) throw new Error("Twilio returned no message SID.");
    await prisma.inventoryWhatsAppDigest.update({
      where: { digestDate },
      data: { status: "SENT", messageSid: sent.sid },
    });
    return { sent: true, date, itemCount: items.length };
  } catch (error) {
    // A timeout can happen after Twilio accepts a message. Do not retry an
    // uncertain send automatically; an operator can inspect the daily claim.
    await prisma.inventoryWhatsAppDigest.update({
      where: { digestDate },
      data: { status: "FAILED" },
    });
    throw error;
  }
}
