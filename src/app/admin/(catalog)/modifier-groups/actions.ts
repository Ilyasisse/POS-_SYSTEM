"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import {
  modifierGroupFields,
  modifierGroupId,
} from "@/lib/catalog/form-validation";

export async function createModifierGroup(formData: FormData) {
  await requirePermission(PERMISSIONS.CATALOG_MANAGE);
  const data = modifierGroupFields(formData);

  await prisma.modifierGroup.create({
    data,
  });

  revalidatePath("/admin/modifier-groups");
  redirect("/admin/modifier-groups");
}

export async function updateModifierGroup(formData: FormData) {
  await requirePermission(PERMISSIONS.CATALOG_MANAGE);
  const id = modifierGroupId(formData);
  const data = modifierGroupFields(formData);

  await prisma.modifierGroup.update({
    where: { id },
    data,
  });

  revalidatePath("/admin/modifier-groups");
  redirect(`/admin/modifier-groups`);
}

export async function deleteModifierGroup(formData: FormData) {
  await requirePermission(PERMISSIONS.CATALOG_MANAGE);
  const id = modifierGroupId(formData);

  await prisma.modifierGroup.delete({
    where: { id },
  });

  // Fixing broken link: the route folder is /admin/modifier-groups.
  revalidatePath("/admin/modifier-groups");
  redirect("/admin/modifier-groups");
}
