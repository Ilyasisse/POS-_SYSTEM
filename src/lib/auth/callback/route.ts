import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getDefaultRouteForUser } from "@/lib/auth/get-default-route-for-user";

/**
 * Handles the auth callback route after Supabase sign-in.
 *
 * Reads the current Supabase session, verifies that the matching Prisma user is
 * active, then redirects the user to the correct application area for their
 * role and station.
 *
 * @returns A redirect response to login or to the user's default route.
 */
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
