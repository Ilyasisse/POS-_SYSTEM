import type { User as SupabaseUser } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";

function getMetadataString(
  metadata: SupabaseUser["user_metadata"],
  key: string,
) {
  const value = metadata?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function getCustomerFullName(user: SupabaseUser) {
  const fullName =
    getMetadataString(user.user_metadata, "full_name") ||
    getMetadataString(user.user_metadata, "name") ||
    getMetadataString(user.user_metadata, "display_name");

  return fullName || user.email || "Google Customer";
}

export async function syncGoogleCustomer(user: SupabaseUser) {
  if (!user.email) {
    throw new Error("Google account is missing an email address.");
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ id: user.id }, { email: user.email }],
    },
  });

  if (existingUser) {
    return existingUser;
  }

  return prisma.user.create({
    data: {
      id: user.id,
      email: user.email,
      fullName: getCustomerFullName(user),
      role: "CUSTOMER",
      isActive: true,
      station: null,
    },
  });
}
