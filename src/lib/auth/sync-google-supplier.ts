import type { User as SupabaseUser } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/suppliers/validation";

function supplierName(user: SupabaseUser) {
  const metadataName = user.user_metadata?.full_name ?? user.user_metadata?.name;
  return typeof metadataName === "string" && metadataName.trim()
    ? metadataName.trim()
    : user.email ?? "Supplier";
}

export async function syncGoogleSupplier(
  user: SupabaseUser,
  supplierSlug: string,
) {
  if (!user.email) throw new Error("Google account is missing an email address.");

  const supplier = await prisma.supplier.findUnique({
    where: { slug: supplierSlug },
    select: { googleEmail: true, isActive: true },
  });
  if (
    !supplier?.isActive ||
    !supplier.googleEmail ||
    normalizeEmail(supplier.googleEmail) !== normalizeEmail(user.email)
  ) {
    throw new Error("This Google account is not assigned to this supplier.");
  }

  const existingByEmail = await prisma.user.findUnique({
    where: { email: user.email },
  });
  if (existingByEmail && existingByEmail.id !== user.id) {
    throw new Error("This email is already linked to another account.");
  }
  if (
    existingByEmail &&
    existingByEmail.role !== "CUSTOMER" &&
    existingByEmail.role !== "SUPPLIER"
  ) {
    throw new Error("A staff account cannot be converted to a supplier account.");
  }

  return prisma.user.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      email: user.email,
      fullName: supplierName(user),
      role: "SUPPLIER",
      isActive: true,
      station: null,
    },
    update: {
      email: user.email,
      role: "SUPPLIER",
      isActive: true,
      station: null,
    },
  });
}
