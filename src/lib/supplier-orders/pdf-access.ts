import { createHmac, timingSafeEqual } from "node:crypto";

export const MAX_WHATSAPP_PDF_BYTES = 16 * 1024 * 1024;

function secret(env: NodeJS.ProcessEnv = process.env) {
  const value = env.SUPPLIER_ORDER_PDF_LINK_SECRET?.trim();
  if (!value || value.length < 32) {
    throw new Error(
      "SUPPLIER_ORDER_PDF_LINK_SECRET must contain at least 32 characters.",
    );
  }
  return value;
}

function digest(deliveryId: string, filename: string, value: string) {
  return createHmac("sha256", value)
    .update(`${deliveryId}:${filename}`)
    .digest("base64url");
}

export function derivePurchaseOrderPdfToken(
  deliveryId: string,
  filename: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  return digest(deliveryId, filename, secret(env));
}

export function verifyPurchaseOrderPdfToken(
  deliveryId: string,
  filename: string,
  token: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  const expected = Buffer.from(digest(deliveryId, filename, secret(env)));
  const received = Buffer.from(token);
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}

export function purchaseOrderPdfMediaPath(
  deliveryId: string,
  orderNumber: number,
  env: NodeJS.ProcessEnv = process.env,
) {
  const filename = `purchase-order-${orderNumber}.pdf`;
  const token = derivePurchaseOrderPdfToken(deliveryId, filename, env);
  return `${deliveryId}/${token}/${filename}`;
}

export function assertWhatsAppPdfSize(pdf: Uint8Array) {
  if (pdf.byteLength > MAX_WHATSAPP_PDF_BYTES) {
    throw new Error("Purchase-order PDF exceeds WhatsApp's 16 MB media limit.");
  }
}
