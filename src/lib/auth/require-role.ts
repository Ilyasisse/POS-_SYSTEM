import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import type { Station, UserRole } from "@prisma/client";

/**
 * Requires a signed-in, active staff user with one of the allowed roles.
 *
 * Reads the current Supabase session, loads the matching Prisma user record,
 * checks role and optional kitchen station access, and redirects to the staff
 * login page when the user is missing, inactive, or unauthorized.
 *
 * @param allowedRoles - Staff roles allowed to access the current route.
 * @param allowedStations - Optional station allowlist for non-admin kitchen users.
 * @returns The active Prisma user record when access is allowed.
 */
export async function requireRole(
  allowedRoles: UserRole[],
  allowedStations?: Station[]
) {
  const supabase = await createClient();

  let authUser;
  // Check if user is not sign in with redirect
  let authReadFailed = false;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    authUser = user;
  } catch (error) {
    console.error("Failed to read Supabase auth session:", error);
    authReadFailed = true;
  }

  if (authReadFailed) {
    redirect("/staff-login?error=unauthorized");
  }

  if (!authUser) {
    redirect("/staff-login");
  }

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
  });

  if (!user || !user.isActive) {
    redirect("/staff-login?error=staff_not_found");
  }

  const isCabitaanRole =
    user.role === "Cabitaan" ||
    (user.role as string) === "CABITAAN";

  if (!allowedRoles.includes(user.role) && !(isCabitaanRole && allowedRoles.includes("Cabitaan"))) {
    redirect("/staff-login?error=unauthorized");
  }

  const effectiveStation =
    user.station ??
    (user.role === "BARISTA"
      ? "BARISTA"
      : isCabitaanRole
        ? "CABITAAN"
        : null);

  if (
    allowedStations &&
    allowedStations.length > 0 &&
    user.role !== "ADMIN" &&
    !(effectiveStation && allowedStations.includes(effectiveStation))
  ) {
    redirect("/staff-login?error=unauthorized");
  }

  return user;
}
