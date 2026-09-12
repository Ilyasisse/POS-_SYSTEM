"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { parseProductMenuContent } from "@/lib/products/product-content";

export async function createProduct(formData: FormData) {
  await requirePermission(PERMISSIONS.CATALOG_MANAGE);
  const name = String(formData.get("name") || "").trim();
  const price = Number(formData.get("price") || 0);
  const trackStock = formData.get("trackStock") === "on";
  const categoryId = String(formData.get("categoryId") || "").trim();
  const pronunciationAudioUrl = String(
    formData.get("pronunciationAudioUrl") || "",
  ).trim();
  const menuContent = parseProductMenuContent({
    description: formData.get("description"),
    imageUrl: formData.get("imageUrl"),
    isActive: formData.get("isActive"),
    isPopular: formData.get("isPopular"),
  });

  if (!name) {
    throw new Error("Product name is required.");
  }

  if (Number.isNaN(price) || price < 0) {
    throw new Error("Price must be a valid number.");
  }

  if (!categoryId) {
    throw new Error("Category is required.");
  }

  await prisma.product.create({
    data: {
      name,
      price,
      trackStock,
      pronunciationAudioUrl: pronunciationAudioUrl || null,
      ...menuContent,
      category: {
        connect: { id: categoryId },
      },
    },
  });

  revalidatePath("/admin/products");
  redirect("/admin/products");
}

export async function updateProduct(formData: FormData) {
  await requirePermission(PERMISSIONS.CATALOG_MANAGE);
  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const price = Number(formData.get("price") || 0);
  const trackStock = formData.get("trackStock") === "on";
  const categoryId = String(formData.get("categoryId") || "").trim();
  const pronunciationAudioUrl = String(
    formData.get("pronunciationAudioUrl") || "",
  ).trim();
  const menuContent = parseProductMenuContent({
    description: formData.get("description"),
    imageUrl: formData.get("imageUrl"),
    isActive: formData.get("isActive"),
    isPopular: formData.get("isPopular"),
  });

  if (!id) {
    throw new Error("Product id is required.");
  }

  if (!name) {
    throw new Error("Product name is required.");
  }

  if (Number.isNaN(price) || price < 0) {
    throw new Error("Price must be a valid number.");
  }

  if (!categoryId) {
    throw new Error("Category is required.");
  }

  await prisma.product.update({
    where: { id },
    data: {
      name,
      price,
      trackStock,
      pronunciationAudioUrl: pronunciationAudioUrl || null,
      ...menuContent,
      category: {
        connect: { id: categoryId },
      },
    },
  });

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products`);
  redirect(`/admin/products`);
}

export async function deleteProduct(formData: FormData) {
  await requirePermission(PERMISSIONS.CATALOG_MANAGE);
  const id = String(formData.get("id") || "").trim();

  if (!id) {
    throw new Error("Product id is required.");
  }

  await prisma.product.delete({
    where: { id },
  });

  revalidatePath("/admin/products");
  redirect("/admin/products");
}
