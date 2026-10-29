"use server";

import { redirect } from "next/navigation";
import {
  saveCatalogItem,
  deleteCatalogItem,
  changeCatalogAvailability,
} from "../actions";

export async function createProduct(data: FormData) {
  const result = await saveCatalogItem("products", data);
  if (!result.ok) throw new Error(result.message);
  redirect("/admin/products");
}

export async function updateProduct(data: FormData) {
  const result = await saveCatalogItem("products", data);
  if (!result.ok) throw new Error(result.message);
  redirect("/admin/products");
}

export async function deleteProduct(data: FormData) {
  const result = await deleteCatalogItem("products", data);
  if (!result.ok) throw new Error(result.message);
  redirect("/admin/products");
}

export async function setProductAvailability(data: FormData) {
  const result = await changeCatalogAvailability(data);
  if (!result.ok) throw new Error(result.message);
}
