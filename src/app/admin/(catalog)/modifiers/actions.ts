"use server";

import { redirect } from "next/navigation";
import { saveCatalogItem, deleteCatalogItem } from "../actions";

export async function createModifier(data: FormData) {
  const result = await saveCatalogItem("modifiers", data);
  if (!result.ok) throw new Error(result.message);
  redirect("/admin/modifiers");
}

export async function updateModifier(data: FormData) {
  const result = await saveCatalogItem("modifiers", data);
  if (!result.ok) throw new Error(result.message);
  redirect("/admin/modifiers");
}

export async function deleteModifier(data: FormData) {
  const result = await deleteCatalogItem("modifiers", data);
  if (!result.ok) throw new Error(result.message);
  redirect("/admin/modifiers");
}
