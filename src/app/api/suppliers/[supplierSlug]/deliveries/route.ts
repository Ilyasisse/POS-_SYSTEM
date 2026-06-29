import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processSupplierDelivery } from "@/lib/suppliers/delivery-service";
import {
  removeSupplierReceipt,
  uploadSupplierReceipt,
} from "@/lib/suppliers/storage";
import { authorizeApi } from "@/lib/auth/api-authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  normalizeEmail,
  receiptExtension,
  validateSupplierReceipt,
} from "@/lib/suppliers/validation";

type RouteContext = { params: Promise<{ supplierSlug: string }> };

export async function POST(request: Request, context: RouteContext) {
  let uploadedPath: string | null = null;

  try {
    const { supplierSlug } = await context.params;
    const authorization = await authorizeApi(
      PERMISSIONS.SUPPLIER_PORTAL_ACCESS,
    );
    if (!authorization.ok) return authorization.response;
    const user = authorization.user;

    const supplier = await prisma.supplier.findUnique({
      where: { slug: supplierSlug },
      select: { id: true, googleEmail: true, isActive: true },
    });
    if (
      !supplier ||
      !supplier.isActive ||
      !supplier.googleEmail ||
      normalizeEmail(supplier.googleEmail) !== normalizeEmail(user.email)
    ) {
      return NextResponse.json({ error: "This Google account is not assigned to this supplier." }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("receipt");
    const notes = String(formData.get("notes") || "").trim().slice(0, 2000);
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a receipt image." }, { status: 400 });
    }
    validateSupplierReceipt(file);

    uploadedPath = `${supplier.id}/${new Date().getUTCFullYear()}/${randomUUID()}.${receiptExtension(file.type)}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    await uploadSupplierReceipt(uploadedPath, bytes, file.type);

    const delivery = await prisma.supplierDelivery.create({
      data: {
        supplierId: supplier.id,
        uploadedByEmail: normalizeEmail(user.email),
        receiptObjectPath: uploadedPath,
        receiptContentType: file.type,
        notes: notes || null,
        deliveryDate: new Date(),
        status: "PENDING_EXTRACTION",
      },
    });
    uploadedPath = null;

    let warning: string | null = null;
    try {
      await processSupplierDelivery(delivery.id);
    } catch (processingError) {
      warning = processingError instanceof Error
        ? processingError.message
        : "Invoice extraction is waiting for an admin retry.";
    }

    return NextResponse.json(
      {
        deliveryId: delivery.id,
        status: warning ? "PENDING_EXTRACTION" : "PENDING_VERIFICATION",
        warning,
      },
      { status: 201 },
    );
  } catch (error) {
    if (uploadedPath) await removeSupplierReceipt(uploadedPath).catch(() => undefined);
    const message = error instanceof Error ? error.message : "Delivery submission failed.";
    const status = /JPEG|PNG|WebP|HEIC|HEIF|10 MB|receipt image/i.test(message) ? 400 : 500;
    console.error("Supplier delivery submission failed:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
