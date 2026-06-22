import { NextResponse } from "next/server";

import { getDefaultRouteForUser } from "@/lib/auth/get-default-route-for-user";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

function getRedirectOrigin(request: Request, requestUrl: URL) {
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (!forwardedHost) {
    return requestUrl.origin;
  }

  const forwardedProto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    "https";

  return `${forwardedProto}://${forwardedHost}`;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const redirectOrigin = getRedirectOrigin(request, requestUrl);
  const supabase = await createClient();

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) {
    return NextResponse.redirect(`${redirectOrigin}/staff-login?error=unauthorized`);
  }

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      role: true,
      station: true,
      isActive: true,
    },
  });

  if (!user) {
    return NextResponse.redirect(`${redirectOrigin}/menu`);
  }

  if (!user.isActive) {
    return NextResponse.redirect(`${redirectOrigin}/staff-login?error=inactive`);
  }

  return NextResponse.redirect(
    `${redirectOrigin}${getDefaultRouteForUser(user)}`,
  );
}
