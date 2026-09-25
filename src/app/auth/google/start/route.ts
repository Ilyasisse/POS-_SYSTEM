import { NextResponse } from "next/server";

import { customerReturnPath } from "@/lib/auth/customer-return-path";
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
  const next = customerReturnPath(requestUrl.searchParams.get("next"));
  const callbackUrl = new URL("/auth/callback", redirectOrigin);
  if (next) callbackUrl.searchParams.set("next", next);
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl.toString(),
    },
  });

  if (error || !data.url) {
    const loginUrl = new URL("/login", redirectOrigin);
    loginUrl.searchParams.set("error", "google-signin-failed");
    if (next) loginUrl.searchParams.set("next", next);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(data.url);
}
