"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";

import { parseModifierAllergenInfo } from "@/lib/products/modifier-allergen-info";

function readModifierInput(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const price = Number(formData.get("price") || 0);
  const modifierGroupId = String(formData.get("modifierGroupId") || "").trim();
  const pronunciationAudioUrl = String(formData.get("pronunciationAudioUrl") || "").trim();
  const productIds = [
    ...new Set(
      formData
        .getAll("productIds")
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];

  console.log(productIds);

  if (!name) throw new Error("Modifier name is required.");
  if (!Number.isFinite(price) || price < 0) throw new Error("Price must be a valid number.");
  if (!productIds.length) throw new Error("At least one product is required.");
  if (!modifierGroupId) throw new Error("Modifier group is required.");

  return {
    productIds,
    data: {
      name,
      allergenInfo: parseModifierAllergenInfo(formData.get("allergenInfo")),
      price,
      modifierGroupId,
      isActive: formData.get("isActive") === "on",
      pronunciationAudioUrl: pronunciationAudioUrl || null,
    },
  };
}

function revalidateModifierCatalog() {
  revalidatePath("/admin/modifiers");
  revalidatePath("/menu");
  revalidatePath("/customer");
  revalidatePath("/api/GET/Product");
  revalidatePath("/api/GET/Product/all");
}

export async function createModifier(formData: FormData) {
  await requirePermission(PERMISSIONS.CATALOG_MANAGE);
  const { productIds, data } = readModifierInput(formData);
  await prisma.$transaction(async (tx) => {
    const count = await tx.product.count({ where: { id: { in: productIds } } });
    if (count !== productIds.length) throw new Error("Some selected products no longer exist.");
    await tx.modifier.create({
      data: {
        ...data,
        products: { connect: productIds.map((id) => ({ id })) },
      },
    });
  });
  revalidateModifierCatalog();
  redirect("/admin/modifiers");
}

export async function updateModifier(formData: FormData) {
  const actor = await requirePermission(PERMISSIONS.CATALOG_MANAGE);
  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Modifier id is required.");
  const { productIds, data } = readModifierInput(formData);
  await prisma.$transaction(async (tx) => {
    const count = await tx.product.count({ where: { id: { in: productIds } } });
    if (count !== productIds.length) throw new Error("Some selected products no longer exist.");
    const previous = await tx.modifier.findUnique({
      where: { id },
      select: { allergenInfo: true },
    });
    if (!previous) throw new Error("Modifier not found.");
    await tx.modifier.update({
      where: { id },
      data: {
        ...data,
        products: { set: productIds.map((id) => ({ id })) },
      },
    });
    if (previous.allergenInfo !== data.allergenInfo) {
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "modifier.allergen_info.updated",
          entityType: "Modifier",
          entityId: id,
          reason: "Catalog modifier allergen information changed",
          previousValue: { allergenInfo: previous.allergenInfo },
          newValue: { allergenInfo: data.allergenInfo },
        },
      });
    }
  });
  revalidateModifierCatalog();
  revalidatePath(`/admin/modifiers/${id}`);
  redirect(`/admin/modifiers/${id}`);
}

export async function deleteModifier(formData: FormData) {
  await requirePermission(PERMISSIONS.CATALOG_MANAGE);
  const id = String(formData.get("id") || "").trim();

  if (!id) {
    throw new Error("Modifier id is required.");
  }

  const usageCount = await prisma.orderItemModifier.count({
    where: { modifierId: id },
  });

  if (usageCount > 0) {
    await prisma.modifier.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  } else {
    await prisma.modifier.delete({
      where: { id },
    });
  }

  revalidateModifierCatalog();
  redirect("/admin/modifiers");
}
