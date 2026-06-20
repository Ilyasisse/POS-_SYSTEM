import type { Station } from "@prisma/client";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  canAccessStation,
  hasPermission,
  type Permission,
} from "@/lib/auth/permissions";

type PermissionScope = { stations?: readonly Station[] };

export async function requirePermission(
  permission: Permission,
  scope: PermissionScope = {},
) {
  const user = await getCurrentUser();

  if (!user) redirect("/staff-login");
  if (!user.isActive) redirect("/staff-login?error=staff_not_found");
  if (!hasPermission(user, permission)) {
    redirect("/staff-login?error=unauthorized");
  }
  if (scope.stations && !canAccessStation(user, scope.stations)) {
    redirect("/staff-login?error=unauthorized");
  }

  return user;
}
