"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import {
  getTodaySupplyDateKey,
  calculateSupplyDayTotal,
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

async function activeCatalogItem(id: string) {
  return prisma.supplyCatalogItem.findFirst({ where: { id, isActive: true } });
}

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

  const item = await activeCatalogItem(parsed.value.catalogItemId);
  if (!item) redirectToSupply(returnDate, "invalid_entry");

  await prisma.$transaction(async (tx) => {
    const day = await tx.supplyDay.upsert({
      where: { purchaseDate },
      create: { purchaseDate },
      update: {},
    });
    if (day.closedAt) throw new Error("Reopen this supply day before adding items.");
    await tx.supplyPurchase.create({ data: {
      catalogItemId: item.id,
      itemName: item.name,
      unit: item.unit,
      purchaseDate,
      quantity: parsed.value.quantity,
      unitPrice: parsed.value.unitPrice,
      createdByUserId: user.id,
    } });
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
    select: { purchaseDate: true, day: { select: { closedAt: true } } },
  });
  if (!existing) redirectToSupply(returnDate, "not_found");
  if (existing.day.closedAt) throw new Error("Reopen this supply day before editing items.");

  const purchaseDate = supplyDateKeyToDatabaseDate(parsed.value.purchaseDateKey);
  if (!purchaseDate) redirectToSupply(returnDate, "invalid_date");

  const item = await activeCatalogItem(parsed.value.catalogItemId);
  if (!item) redirectToSupply(returnDate, "invalid_entry");

  await prisma.$transaction(async (tx) => {
    const targetDay = await tx.supplyDay.upsert({ where: { purchaseDate }, create: { purchaseDate }, update: {} });
    if (targetDay.closedAt) throw new Error("Reopen the target supply day before moving items.");
    await tx.supplyPurchase.update({
    where: { id },
    data: {
      catalogItemId: item.id,
      itemName: item.name,
      unit: item.unit,
      purchaseDate,
      quantity: parsed.value.quantity,
      unitPrice: parsed.value.unitPrice,
    } });
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

  const existing = await prisma.supplyPurchase.findUnique({ where: { id }, include: { day: { select: { closedAt: true } } } });
  if (existing?.day.closedAt) throw new Error("Reopen this supply day before deleting items.");
  const result = await prisma.supplyPurchase.deleteMany({ where: { id } });
  if (result.count === 0) redirectToSupply(returnDate, "not_found");

  revalidatePath("/admin/supplies");
  redirectToSupply(returnDate || getTodaySupplyDateKey(), "deleted");
}

export async function closeSupplyDay(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.SUPPLY_MANAGE);
  const dateKey = resolveSupplyDateKey(String(formData.get("date") ?? ""));
  const purchaseDate = supplyDateKeyToDatabaseDate(dateKey);
  if (!purchaseDate) redirectToSupply(dateKey, "invalid_date");
  await prisma.$transaction(async (tx) => {
    const entries = await tx.supplyPurchase.findMany({ where: { purchaseDate }, select: { quantity: true, unitPrice: true } });
    if (entries.length === 0) throw new Error("Add at least one supply before closing the day.");
    const total = calculateSupplyDayTotal(entries);
    await tx.supplyDay.upsert({
      where: { purchaseDate },
      create: { purchaseDate, closedTotal: total, closedAt: new Date(), closedByUserId: user.id },
      update: { closedTotal: total, closedAt: new Date(), closedByUserId: user.id },
    });
  });
  revalidatePath("/admin/supplies");
  revalidatePath("/admin/daily-cash");
}

export async function reopenSupplyDay(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.SUPPLY_MANAGE);
  const dateKey = resolveSupplyDateKey(String(formData.get("date") ?? ""));
  const purchaseDate = supplyDateKeyToDatabaseDate(dateKey);
  if (!purchaseDate) redirectToSupply(dateKey, "invalid_date");
  await prisma.$transaction(async (tx) => {
    const day = await tx.supplyDay.findUnique({ where: { purchaseDate }, include: { _count: { select: { payments: true } } } });
    if (!day?.closedAt) throw new Error("This supply day is not closed.");
    if (day._count.payments > 0) throw new Error("A supply day with payments cannot be reopened.");
    await tx.supplyDay.update({ where: { id: day.id }, data: { closedTotal: null, closedAt: null, closedByUserId: null, reopenedAt: new Date(), reopenedByUserId: user.id } });
  });
  revalidatePath("/admin/supplies");
  revalidatePath("/admin/daily-cash");
}
