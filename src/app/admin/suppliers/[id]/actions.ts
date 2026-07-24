"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { parseSupplierCatalogItemInput } from "@/lib/suppliers/purchase-orders";

type CatalogStatus =
  | "created"
  | "updated"
  | "duplicate"
  | "invalid_target"
  | "invalid_unit"
  | "invalid_price"
  | "target_unavailable"
  | "not_found";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function catalogPath(supplierId: string, status: CatalogStatus) {
  return `/admin/suppliers/${encodeURIComponent(supplierId)}?catalogStatus=${status}`;
}

function redirectToCatalog(supplierId: string, status: CatalogStatus): never {
  redirect(catalogPath(supplierId, status));
}

function parseTarget(value: string) {
  const separator = value.indexOf(":");
  if (separator < 1) return null;
  const targetKind = value.slice(0, separator);
  const targetId = value.slice(separator + 1);
  if (
    (targetKind !== "product" && targetKind !== "supply") ||
    !targetId
  ) {
    return null;
  }
  return { targetKind, targetId } as const;
}

function activeValue(formData: FormData) {
  return formData.getAll("isActive").map(String).includes("true");
}

function refreshCatalog(supplierId: string) {
  revalidatePath("/admin/suppliers");
  revalidatePath(`/admin/suppliers/${supplierId}`);
}

function isUniqueError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createSupplierCatalogItem(formData: FormData) {
  await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const supplierId = text(formData, "supplierId");
  const target = parseTarget(text(formData, "target"));
  if (!supplierId) redirect("/admin/suppliers");
  if (!target) redirectToCatalog(supplierId, "invalid_target");

  const parsed = parseSupplierCatalogItemInput({
    ...target,
    unit: formData.get("unit"),
    unitPrice: formData.get("unitPrice"),
    isActive: activeValue(formData),
  });
  if (!parsed.ok) redirectToCatalog(supplierId, parsed.status);

  const [supplier, targetAvailable] = await Promise.all([
    prisma.supplier.findUnique({ where: { id: supplierId }, select: { id: true } }),
    parsed.value.targetKind === "product"
      ? prisma.product.findFirst({
          where: { id: parsed.value.targetId, isActive: true },
          select: { id: true },
        })
      : prisma.inventorySupply.findFirst({
          where: { id: parsed.value.targetId, isActive: true },
          select: { id: true },
        }),
  ]);
  if (!supplier) redirect("/admin/suppliers");
  if (!targetAvailable) redirectToCatalog(supplierId, "target_unavailable");

  try {
    await prisma.supplierCatalogItem.create({
      data: {
        supplierId,
        productId:
          parsed.value.targetKind === "product" ? parsed.value.targetId : null,
        inventorySupplyId:
          parsed.value.targetKind === "supply" ? parsed.value.targetId : null,
        unit: parsed.value.unit,
        unitPrice: parsed.value.unitPrice,
        isActive: parsed.value.isActive,
      },
    });
  } catch (error) {
    if (isUniqueError(error)) redirectToCatalog(supplierId, "duplicate");
    throw error;
  }

  refreshCatalog(supplierId);
  redirectToCatalog(supplierId, "created");
}

export async function updateSupplierCatalogItem(formData: FormData) {
  await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const supplierId = text(formData, "supplierId");
  const catalogItemId = text(formData, "catalogItemId");
  if (!supplierId) redirect("/admin/suppliers");
  if (!catalogItemId) redirectToCatalog(supplierId, "not_found");

  const existing = await prisma.supplierCatalogItem.findFirst({
    where: { id: catalogItemId, supplierId },
    select: { productId: true, inventorySupplyId: true },
  });
  if (!existing) redirectToCatalog(supplierId, "not_found");

  const targetKind = existing.productId ? "product" : "supply";
  const targetId = existing.productId ?? existing.inventorySupplyId;
  if (!targetId) redirectToCatalog(supplierId, "not_found");

  const parsed = parseSupplierCatalogItemInput({
    targetKind,
    targetId,
    unit: formData.get("unit"),
    unitPrice: formData.get("unitPrice"),
    isActive: activeValue(formData),
  });
  if (!parsed.ok) redirectToCatalog(supplierId, parsed.status);

  const result = await prisma.supplierCatalogItem.updateMany({
    where: { id: catalogItemId, supplierId },
    data: {
      unit: parsed.value.unit,
      unitPrice: parsed.value.unitPrice,
      isActive: parsed.value.isActive,
    },
  });
  if (result.count !== 1) redirectToCatalog(supplierId, "not_found");

  refreshCatalog(supplierId);
  redirectToCatalog(supplierId, "updated");
}
