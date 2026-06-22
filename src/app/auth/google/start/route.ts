import { NextResponse } from "next/server";

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

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${redirectOrigin}/auth/callback`,
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(`${redirectOrigin}/?error=google-signin-failed`);
  }

  return NextResponse.redirect(data.url);
}
