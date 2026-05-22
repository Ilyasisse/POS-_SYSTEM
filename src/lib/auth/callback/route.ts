import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getDefaultRouteForUser } from "@/lib/auth/getDefaultRouteForUser";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.redirect(new URL("/staff-login", process.env.NEXT_PUBLIC_APP_URL));
  }

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
  });

  if (!user || !user.isActive) {
    return NextResponse.redirect(
      new URL("/staff-login?error=staff_not_found", process.env.NEXT_PUBLIC_APP_URL)
    );
  }

  const redirectTo = getDefaultRouteForUser(user);

  return NextResponse.redirect(
    new URL(redirectTo, process.env.NEXT_PUBLIC_APP_URL)
  );
}
