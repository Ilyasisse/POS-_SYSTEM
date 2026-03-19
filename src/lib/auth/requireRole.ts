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

  if (!allowedRoles.includes(user.role)) {
    redirect("/login?error=unauthorized");
  }

  if (
    allowedStations &&
    allowedStations.length > 0 &&
    user.role !== "ADMIN" &&
    !(
      (user.role === "BARISTA" && allowedStations.includes("BARISTA")) ||
      (user.station && allowedStations.includes(user.station))
    )
  ) {
    redirect("/login?error=unauthorized");
  }

  return user;
}
