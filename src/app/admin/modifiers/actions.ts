"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";

export async function createModifier(formData: FormData) {
  await requirePermission(PERMISSIONS.CATALOG_MANAGE);
  const name = String(formData.get("name") || "").trim();
  const price = Number(formData.get("price") || 0);
  const isActive = formData.get("isActive") === "on";
  const modifierGroupId = String(formData.get("modifierGroupId") || "").trim();
  const pronunciationAudioUrl = String(
    formData.get("pronunciationAudioUrl") || "",
  ).trim();

  const productIds = formData
    .getAll("productIds")
    .map((value) => String(value).trim())
    .filter(Boolean);

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
          price,
          isActive,
          productId,
          modifierGroupId,
          pronunciationAudioUrl: pronunciationAudioUrl || null,
        },
      })
    )
  );

  revalidatePath("/admin/modifiers");
  redirect("/admin/modifiers");
}

export async function updateModifier(formData: FormData) {
  await requirePermission(PERMISSIONS.CATALOG_MANAGE);
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

  await prisma.modifier.update({
    where: { id },
    data: {
      name,
      price,
      isActive,
      productId,
      modifierGroupId,
      pronunciationAudioUrl: pronunciationAudioUrl || null,
    },
  });

  revalidatePath("/admin/modifiers");
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

  revalidatePath("/admin/modifiers");
  redirect("/admin/modifiers");
}
