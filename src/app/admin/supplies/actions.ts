"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import {
  getTodaySupplyDateKey,
  parseSupplyPurchaseInput,
  resolveSupplyDateKey,
  supplyDateKeyToDatabaseDate,
} from "@/lib/supplies/supply-purchases";

type SupplyStatus =
  | "created"
  | "updated"
  | "deleted"
  | "invalid_date"
  | "invalid_entry"
  | "not_found";

function supplyPath(date: string, status: SupplyStatus) {
  return `/admin/supplies?date=${encodeURIComponent(date)}&supplyStatus=${status}`;
}

function redirectToSupply(date: string, status: SupplyStatus): never {
  redirect(supplyPath(date, status));
}

export async function createSupplyPurchase(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.SUPPLY_MANAGE);
  const parsed = parseSupplyPurchaseInput(formData);
  const returnDate = resolveSupplyDateKey(
    String(formData.get("purchaseDate") ?? ""),
  );

  if (!parsed.ok) redirectToSupply(returnDate, parsed.status);

  const purchaseDate = supplyDateKeyToDatabaseDate(parsed.value.purchaseDateKey);
  if (!purchaseDate) redirectToSupply(returnDate, "invalid_date");

  await prisma.supplyPurchase.create({
    data: {
      itemName: parsed.value.itemName,
      purchaseDate,
      quantity: parsed.value.quantity,
      unitPrice: parsed.value.unitPrice,
      createdByUserId: user.id,
    },
  });

  revalidatePath("/admin/supplies");
  redirectToSupply(parsed.value.purchaseDateKey, "created");
}

export async function updateSupplyPurchase(formData: FormData) {
  await requirePermission(PERMISSIONS.SUPPLY_MANAGE);
  const id = String(formData.get("id") ?? "").trim();
  const parsed = parseSupplyPurchaseInput(formData);
  const returnDate = resolveSupplyDateKey(
    String(formData.get("purchaseDate") ?? ""),
  );

  if (!id) redirectToSupply(returnDate, "not_found");
  if (!parsed.ok) redirectToSupply(returnDate, parsed.status);

  const existing = await prisma.supplyPurchase.findUnique({
    where: { id },
    select: { purchaseDate: true },
  });
  if (!existing) redirectToSupply(returnDate, "not_found");

  const purchaseDate = supplyDateKeyToDatabaseDate(parsed.value.purchaseDateKey);
  if (!purchaseDate) redirectToSupply(returnDate, "invalid_date");

  await prisma.supplyPurchase.update({
    where: { id },
    data: {
      itemName: parsed.value.itemName,
      purchaseDate,
      quantity: parsed.value.quantity,
      unitPrice: parsed.value.unitPrice,
    },
  });

  revalidatePath("/admin/supplies");
  redirectToSupply(parsed.value.purchaseDateKey, "updated");
}

export async function deleteSupplyPurchase(formData: FormData) {
  await requirePermission(PERMISSIONS.SUPPLY_MANAGE);
  const id = String(formData.get("id") ?? "").trim();
  const returnDate = resolveSupplyDateKey(
    String(formData.get("returnDate") ?? ""),
  );

  if (!id) redirectToSupply(returnDate, "not_found");

  const result = await prisma.supplyPurchase.deleteMany({ where: { id } });
  if (result.count === 0) redirectToSupply(returnDate, "not_found");

  revalidatePath("/admin/supplies");
  redirectToSupply(returnDate || getTodaySupplyDateKey(), "deleted");
}
