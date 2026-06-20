import type { Station, UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canAccessStation } from "@/lib/auth/permissions";

/** Compatibility helper for routes not yet expressed as business permissions. */
export async function requireRole(
  allowedRoles: UserRole[],
  allowedStations?: Station[],
) {
  const user = await getCurrentUser();

  if (!user) redirect("/staff-login");
  if (!user.isActive) redirect("/staff-login?error=staff_not_found");
  if (!allowedRoles.includes(user.role)) {
    redirect("/staff-login?error=unauthorized");
  }
  if (allowedStations && !canAccessStation(user, allowedStations)) {
    redirect("/staff-login?error=unauthorized");
  }

  return user;
}
