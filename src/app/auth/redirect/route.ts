import { NextResponse } from "next/server";

import { getDefaultRouteForUser } from "@/lib/auth/get-default-route-for-user";
import { findAppUser } from "@/lib/auth/app-user";
import { createClient } from "@/lib/supabase/server";

function getRedirectOrigin(request: Request, requestUrl: URL) {
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (!forwardedHost) {
    return requestUrl.origin;
  }

  const forwardedProto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";

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
    return NextResponse.redirect(
      `${redirectOrigin}/staff-login?error=unauthorized`,
    );
  }

  const user = await findAppUser(authUser.id);

  if (!user) {
    return NextResponse.redirect(`${redirectOrigin}/menu`);
  }

  if (!user.isActive) {
    return NextResponse.redirect(
      `${redirectOrigin}/staff-login?error=inactive`,
    );
  }

  return NextResponse.redirect(
    `${redirectOrigin}${getDefaultRouteForUser(user)}`,
  );
}
