"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/require-role";
import {
  isValidSupplierSlug,
  normalizeEmail,
  normalizeSupplierSlug,
} from "@/lib/suppliers/validation";

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function supplierData(formData: FormData) {
  const name = text(formData, "name");
  const slug = normalizeSupplierSlug(text(formData, "slug") || name);
  const googleEmailValue = text(formData, "googleEmail");
  if (!name) throw new Error("Supplier name is required.");
  if (!isValidSupplierSlug(slug)) throw new Error("Enter a valid supplier slug.");

  return {
    name,
    slug,
    contactName: text(formData, "contactName") || null,
    phone: text(formData, "phone") || null,
    email: text(formData, "email") || null,
    googleEmail: googleEmailValue ? normalizeEmail(googleEmailValue) : null,
    notes: text(formData, "notes") || null,
    isActive: formData.getAll("isActive").map(String).includes("true"),
  };
}

export async function createSupplier(formData: FormData) {
  await requireRole(["ADMIN", "MANAGER"]);
  await prisma.supplier.create({ data: supplierData(formData) });
  revalidatePath("/admin/suppliers");
}

export async function updateSupplier(formData: FormData) {
  await requireRole(["ADMIN", "MANAGER"]);
  const id = text(formData, "id");
  if (!id) throw new Error("Supplier is required.");
  await prisma.supplier.update({ where: { id }, data: supplierData(formData) });
  revalidatePath("/admin/suppliers");
  revalidatePath("/admin/supplier-deliveries");
}
