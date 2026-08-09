"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { parseCurrencyAmount } from "@/lib/currency/amount-input";
import { prisma } from "@/lib/prisma";

const field = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

function values(formData: FormData) {
  const name = field(formData, "name");
  const unit = field(formData, "unit");
  const priceText = field(formData, "defaultUnitPrice");
  const price = parseCurrencyAmount(priceText);
  if (!name || name.length > 160 || !unit || unit.length > 40 || price === null) {
    throw new Error("Enter a name, unit, and valid default price.");
  }
  return { name, unit, defaultUnitPrice: new Prisma.Decimal(priceText) };
}

function refresh() {
  revalidatePath("/admin/supplies/items");
  revalidatePath("/admin/supplies");
}

export async function createSupplyCatalogItem(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.SUPPLY_MANAGE);
  await prisma.supplyCatalogItem.create({ data: { ...values(formData), createdByUserId: user.id } });
  refresh();
}

export async function updateSupplyCatalogItem(formData: FormData) {
  await requirePermission(PERMISSIONS.SUPPLY_MANAGE);
  const id = field(formData, "id");
  if (!id) throw new Error("Supply item not found.");
  await prisma.supplyCatalogItem.update({ where: { id }, data: values(formData) });
  refresh();
}

export async function setSupplyCatalogItemActive(formData: FormData) {
  await requirePermission(PERMISSIONS.SUPPLY_MANAGE);
  const id = field(formData, "id");
  if (!id) throw new Error("Supply item not found.");
  await prisma.supplyCatalogItem.update({ where: { id }, data: { isActive: field(formData, "active") === "true" } });
  refresh();
}
