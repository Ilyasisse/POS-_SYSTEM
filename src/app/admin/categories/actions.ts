"use server";

import { prisma } from "@/lib/prisma";
import { normalizeKitchenStation } from "@/lib/kitchen-socket";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createCategory(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const sortOrder = Number(formData.get("sortOrder") || 0);
  const isActive = formData.get("isActive") === "on";
  const station = normalizeKitchenStation(
    String(formData.get("station") || "").trim() || null,
  );

  if (!name) {
    throw new Error("Category name is required.");
  }

  if (Number.isNaN(sortOrder) || sortOrder < 0) {
    throw new Error("Sort order must be a valid number.");
  }

  await prisma.category.create({
    data: {
      name,
      sortOrder,
      isActive,
      station: station ?? null,
    },
  });

  revalidatePath("/admin/categories");
  redirect("/admin/categories");
}

export async function updateCategory(formData: FormData) {
  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const sortOrder = Number(formData.get("sortOrder") || 0);
  const isActive = formData.get("isActive") === "on";
  const station = normalizeKitchenStation(
    String(formData.get("station") || "").trim() || null,
  );

  if (!id) {
    throw new Error("Category id is required.");
  }

  if (!name) {
    throw new Error("Category name is required.");
  }

  if (Number.isNaN(sortOrder) || sortOrder < 0) {
    throw new Error("Sort order must be a valid number.");
  }

  await prisma.category.update({
    where: { id },
    data: {
      name,
      sortOrder,
      isActive,
      station: station ?? null,
    },
  });

  revalidatePath("/admin/categories");
  revalidatePath(`/admin/categories/${id}`);
  redirect(`/admin/categories/${id}`);
}

export async function deleteCategory(formData: FormData) {
  const id = String(formData.get("id") || "").trim();

  if (!id) {
    throw new Error("Category id is required.");
  }

  await prisma.category.delete({
    where: { id },
  });

  revalidatePath("/admin/categories");
  redirect("/admin/categories");
}
