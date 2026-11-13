"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { parseModifierAllergenInfo } from "@/lib/products/modifier-allergen-info";

export async function createModifier(formData: FormData) {
  await requirePermission(PERMISSIONS.CATALOG_MANAGE);
  const allergenInfo = parseModifierAllergenInfo(formData.get("allergenInfo"));
  const name = String(formData.get("name") || "").trim();
  const price = Number(formData.get("price") || 0);
  const isActive = formData.get("isActive") === "on";
  const modifierGroupId = String(formData.get("modifierGroupId") || "").trim();
  const pronunciationAudioUrl = String(
    formData.get("pronunciationAudioUrl") || "",
  ).trim();

  const productIds = formData.getAll("productIds").flatMap((value) => {
    const productId = String(value).trim();
    return productId ? [productId] : [];
  });

  if (!name) {
    throw new Error("Modifier name is required.");
  }

  if (productIds.length === 0) {
    throw new Error("At least one product is required.");
  }

  if (!modifierGroupId) {
    throw new Error("Modifier group is required.");
  }

  await prisma.$transaction(
    productIds.map((productId) =>
      prisma.modifier.create({
        data: {
          name,
          allergenInfo,
          price,
          isActive,
          productId,
          modifierGroupId,
          pronunciationAudioUrl: pronunciationAudioUrl || null,
        },
      }),
    ),
  );

  revalidatePath("/admin/modifiers");
  revalidatePath("/menu");
  revalidatePath("/customer");
  revalidatePath("/api/GET/Product/all");
  revalidatePath("/api/GET/Product");
  redirect("/admin/modifiers");
}

export async function updateModifier(formData: FormData) {
  const actor = await requirePermission(PERMISSIONS.CATALOG_MANAGE);
  const allergenInfo = parseModifierAllergenInfo(formData.get("allergenInfo"));
  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const price = Number(formData.get("price") || 0);
  const isActive = formData.get("isActive") === "on";
  const productId = String(formData.get("productId") || "").trim();
  const modifierGroupId = String(formData.get("modifierGroupId") || "").trim();
  const pronunciationAudioUrl = String(
    formData.get("pronunciationAudioUrl") || "",
  ).trim();

  if (!id) {
    throw new Error("Modifier id is required.");
  }

  if (!name) {
    throw new Error("Modifier name is required.");
  }

  if (Number.isNaN(price) || price < 0) {
    throw new Error("Price must be a valid number.");
  }

  if (!productId) {
    throw new Error("Product is required.");
  }

  if (!modifierGroupId) {
    throw new Error("Modifier group is required.");
  }

  await prisma.$transaction(async (tx) => {
    const previous = await tx.modifier.findUnique({
      where: { id },
      select: { allergenInfo: true },
    });
    if (!previous) throw new Error("Modifier not found.");
    await tx.modifier.update({
      where: { id },
      data: {
        name,
        allergenInfo,
        price,
        isActive,
        productId,
        modifierGroupId,
        pronunciationAudioUrl: pronunciationAudioUrl || null,
      },
    });
    if (previous.allergenInfo !== allergenInfo) {
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "modifier.allergen_info.updated",
          entityType: "Modifier",
          entityId: id,
          reason: "Catalog modifier allergen information changed",
          previousValue: { allergenInfo: previous.allergenInfo },
          newValue: { allergenInfo },
        },
      });
    }
  });

  revalidatePath("/admin/modifiers");
  revalidatePath(`/admin/modifiers/${id}`);
  revalidatePath("/customer");
  revalidatePath("/api/GET/Product/all");
  revalidatePath("/api/GET/Product");
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

  revalidatePath("/admin/modifiers");
  redirect("/admin/modifiers");
}
