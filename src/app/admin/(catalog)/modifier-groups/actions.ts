"use server";

import { redirect } from "next/navigation";
import { saveCatalogItem, deleteCatalogItem } from "../actions";

export async function createModifierGroup(data: FormData) {
  const result = await saveCatalogItem("modifier-groups", data);
  if (!result.ok) throw new Error(result.message);
  redirect("/admin/modifier-groups");
}

export async function updateModifierGroup(data: FormData) {
  const result = await saveCatalogItem("modifier-groups", data);
  if (!result.ok) throw new Error(result.message);
  redirect("/admin/modifier-groups");
}

export async function deleteModifierGroup(data: FormData) {
  const result = await deleteCatalogItem("modifier-groups", data);
  if (!result.ok) throw new Error(result.message);
  redirect("/admin/modifier-groups");
}
