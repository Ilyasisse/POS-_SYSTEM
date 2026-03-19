import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import type { Station, UserRole } from "@prisma/client";

export async function requireRole(
  allowedRoles: UserRole[],
  allowedStations?: Station[]
) {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
  });

  if (!user || !user.isActive) {
    redirect("/login?error=staff_not_found");
  }

  const isCabitaanRole =
    user.role === "Cabitaan" ||
    (user.role as string) === "CABITAAN";

  if (!allowedRoles.includes(user.role) && !(isCabitaanRole && allowedRoles.includes("Cabitaan"))) {
    redirect("/login?error=unauthorized");
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
    redirect("/login?error=unauthorized");
  }

  return user;
}
