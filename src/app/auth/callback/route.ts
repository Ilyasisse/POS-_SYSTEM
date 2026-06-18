import { NextResponse } from "next/server";
import { syncGoogleCustomer } from "@/lib/auth/sync-google-customer";
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
  const code = requestUrl.searchParams.get("code");
  let next = requestUrl.searchParams.get("next") ?? "/menu";

  if (!next.startsWith("/")) {
    next = "/menu";
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return NextResponse.redirect(
          `${redirectOrigin}/?error=google-signin-failed`,
        );
      }

      try {
        await syncGoogleCustomer(user);
      } catch (error) {
        console.error("Failed to sync Google customer:", error);

        return NextResponse.redirect(
          `${redirectOrigin}/?error=google-signin-failed`,
        );
      }

      return NextResponse.redirect(`${redirectOrigin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${redirectOrigin}/?error=google-signin-failed`,
  );
}
