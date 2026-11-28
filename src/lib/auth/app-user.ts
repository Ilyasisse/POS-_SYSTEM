import { prisma } from "@/lib/prisma";
import { resolveAppProfile } from "@/lib/auth/profile-resolution";

/** Resolve only a verified Auth ID; email is never an account-linking key. */
export function findAppUser(id: string) {
  return resolveAppProfile(id, prisma);
}
