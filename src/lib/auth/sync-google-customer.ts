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

/** Create only a customer profile for the verified Auth ID; never grant a staff role. */
export async function syncGoogleCustomer(user: SupabaseUser) {
  if (!user.email)
    throw new Error("Google account is missing an email address.");

  // Empty update preserves administrative deactivation and existing profile data.
  return prisma.customer.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      email: user.email,
      fullName: getCustomerFullName(user),
    },
    update: {},
  });
}
