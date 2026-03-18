"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createModifierGroup(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const minSelect = Number(formData.get("minSelect") || 0);
  const maxSelect = Number(formData.get("maxSelect") || 1);
  const isActive = formData.get("isActive") === "on";

  await prisma.modifierGroup.create({
    data: {
      name,
      minSelect,
      maxSelect,
      isActive,
    },
  });

  revalidatePath("/admin/modifiers-groups");
  redirect("/admin/modifiers-groups");
}

export async function updateModifierGroup(formData: FormData) {
  const id = String(formData.get("id"));
  const name = String(formData.get("name"));
  const minSelect = Number(formData.get("minSelect"));
  const maxSelect = Number(formData.get("maxSelect"));
  const isActive = formData.get("isActive") === "on";

  await prisma.modifierGroup.update({
    where: { id },
    data: {
      name,
      minSelect,
      maxSelect,
      isActive,
    },
  });

  revalidatePath("/admin/modifier-groups");
  redirect(`/admin/modifier-groups/${id}`);
}

export async function deleteModifierGroup(formData: FormData) {
  const id = String(formData.get("id"));

  await prisma.modifierGroup.delete({
    where: { id },
  });

  revalidatePath("/admin/modifier-groups");
  redirect("/admin/modifier-groups");
}