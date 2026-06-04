import type { User as SupabaseUser } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";

/**
 * Reads a trimmed string value from Supabase user metadata.
 *
 * @param metadata - Supabase user metadata object.
 * @param key - Metadata field name to read.
 * @returns The trimmed string value, or an empty string when unavailable.
 */
function getMetadataString(
  metadata: SupabaseUser["user_metadata"],
  key: string,
) {
  const value = metadata?.[key];
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Builds the display name used for a Google customer account.
 *
 * Checks common Google profile metadata fields first, then falls back to the
 * email address and finally a generic customer name.
 *
 * @param user - Supabase user returned from Google OAuth.
 * @returns A non-empty customer full name.
 */
function getCustomerFullName(user: SupabaseUser) {
  const fullName =
    getMetadataString(user.user_metadata, "full_name") ||
    getMetadataString(user.user_metadata, "name") ||
    getMetadataString(user.user_metadata, "display_name");

  return fullName || user.email || "Google Customer";
}

/**
 * Ensures a Google OAuth user exists as an active customer in Prisma.
 *
 * Reuses an existing user when the Supabase id or email already exists. When no
 * matching user is found, creates a new active `CUSTOMER` record with no staff
 * station.
 *
 * @param user - Supabase user returned from Google OAuth.
 * @returns The existing or newly created Prisma user.
 * @throws When the Google account does not provide an email address.
 */
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
