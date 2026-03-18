"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createModifier(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const price = Number(formData.get("price") || 0);
  const isActive = formData.get("isActive") === "on";
  const modifierGroupId = String(formData.get("modifierGroupId") || "").trim();

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
        },
      })
    )
  );

  revalidatePath("/admin/modifiers");
  redirect("/admin/modifiers");
}

export async function updateModifier(formData: FormData) {
  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const price = Number(formData.get("price") || 0);
  const isActive = formData.get("isActive") === "on";
  const productId = String(formData.get("productId") || "").trim();
  const modifierGroupId = String(formData.get("modifierGroupId") || "").trim();

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
    },
  });

  revalidatePath("/admin/modifiers");
  revalidatePath(`/admin/modifiers/${id}`);
  redirect(`/admin/modifiers/${id}`);
}

export async function deleteModifier(formData: FormData) {
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