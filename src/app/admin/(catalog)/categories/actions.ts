"use server";

import { redirect } from "next/navigation";
import { saveCatalogItem, deleteCatalogItem } from "../actions";

export async function createCategory(data: FormData) {
  const result = await saveCatalogItem("categories", data);
  if (!result.ok) throw new Error(result.message);
  redirect("/admin/categories");
}

export async function updateCategory(data: FormData) {
  const result = await saveCatalogItem("categories", data);
  if (!result.ok) throw new Error(result.message);
  redirect("/admin/categories");
}

export async function deleteCategory(data: FormData) {
  const result = await deleteCatalogItem("categories", data);
  if (!result.ok) throw new Error(result.message);
  redirect("/admin/categories");
}
