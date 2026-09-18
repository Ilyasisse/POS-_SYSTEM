import { NextResponse } from "next/server";
import { customerReturnPath } from "@/lib/auth/customer-return-path";
import { findAppUser } from "@/lib/auth/app-user";
import { syncGoogleCustomer } from "@/lib/auth/sync-google-customer";
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
  const code = requestUrl.searchParams.get("code");
  const next = customerReturnPath(requestUrl.searchParams.get("next"));
  const loginUrl = new URL("/login", redirectOrigin);
  loginUrl.searchParams.set("error", "google-signin-failed");
  if (next) loginUrl.searchParams.set("next", next);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return NextResponse.redirect(loginUrl);
      }

      const existingProfile = await findAppUser(user.id);
      if (existingProfile && existingProfile.role !== "CUSTOMER") {
        return NextResponse.redirect(new URL("/auth/redirect", redirectOrigin));
      }

      try {
        await syncGoogleCustomer(user);
      } catch (error) {
        console.error("Failed to sync Google customer:", error);
        await supabase.auth.signOut();
        return NextResponse.redirect(loginUrl);
      }

      if (next) {
        const profile = await findAppUser(user.id);
        if (profile?.role === "CUSTOMER" && profile.isActive) {
          return NextResponse.redirect(new URL(next, redirectOrigin));
        }
        return NextResponse.redirect(new URL("/auth/redirect", redirectOrigin));
      }
      return NextResponse.redirect(`${redirectOrigin}/menu`);
    }
  }

  return NextResponse.redirect(loginUrl);
}
