import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  assertWhatsAppPdfSize,
  verifyPurchaseOrderPdfToken,
} from "@/lib/supplier-orders/pdf-access";
import { generatePurchaseOrderPdf } from "@/lib/supplier-orders/purchase-order-pdf";
import {
  purchaseOrderPdfInclude,
  purchaseOrderPdfInput,
  samplePurchaseOrderPdfInput,
} from "@/lib/supplier-orders/purchase-order-pdf-snapshot";

export const runtime = "nodejs";

const securityHeaders = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

function invalidLink() {
  return NextResponse.json(
    { error: "The PDF link is invalid." },
    { status: 404, headers: securityHeaders },
  );
}

function pdfResponse(pdf: Uint8Array, filename: string, sample = false) {
  assertWhatsAppPdfSize(pdf);
  return new Response(Buffer.from(pdf), {
    status: 200,
    headers: {
      ...securityHeaders,
      "Cache-Control": sample ? "public, max-age=3600" : securityHeaders["Cache-Control"],
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  if (path.length === 1 && path[0] === "sample.pdf") {
    const pdf = await generatePurchaseOrderPdf(samplePurchaseOrderPdfInput());
    return pdfResponse(pdf, "sample-purchase-order.pdf", true);
  }
  if (path.length !== 3) return invalidLink();

  const [deliveryId, token, filename] = path;
  if (!/^purchase-order-\d+\.pdf$/.test(filename)) return invalidLink();
  try {
    if (!verifyPurchaseOrderPdfToken(deliveryId, filename, token)) {
      return invalidLink();
    }
  } catch {
    return invalidLink();
  }

  const delivery = await prisma.supplierOrderWhatsAppDelivery.findFirst({
    where: { id: deliveryId, provider: "TWILIO", type: "SUPPLIER_ORDER" },
    select: {
      run: {
        select: {
          purchaseOrder: { include: purchaseOrderPdfInclude },
        },
      },
    },
  });
  const order = delivery?.run.purchaseOrder;
  if (!order || filename !== `purchase-order-${order.orderNumber}.pdf`) {
    return invalidLink();
  }

  const pdf = await generatePurchaseOrderPdf(purchaseOrderPdfInput(order));
  return pdfResponse(pdf, filename);
}
