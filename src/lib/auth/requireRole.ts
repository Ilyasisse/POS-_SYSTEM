import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

type AllowedRole =
  | "ADMIN"
  | "WAITER"
  | "KITCHEN"
  | "BARISTA"
  | "CASHIER"
  | string;

export async function requireRole(allowedRoles: AllowedRole[]) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const staffUser = await prisma.user.findUnique({
    where: {
      id: user.id,
    },
  });

  if (!staffUser) {
    redirect("/login?error=staff-not-found");
  }

  if (!staffUser.isActive) {
    redirect("/login?error=inactive");
  }

  if (!allowedRoles.includes(staffUser.role)) {
    redirect("/login?error=unauthorized");
  }

  return staffUser;
}