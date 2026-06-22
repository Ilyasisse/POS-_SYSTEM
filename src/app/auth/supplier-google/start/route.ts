import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeInternalReturnPath } from "@/lib/suppliers/validation";

function redirectOrigin(request: Request, url: URL) {
  const host = request.headers.get("x-forwarded-host");
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  return host ? `${protocol}://${host}` : url.origin;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = redirectOrigin(request, url);
  const returnPath = safeInternalReturnPath(url.searchParams.get("next"));
  if (!returnPath?.startsWith("/supplier/")) {
    return NextResponse.redirect(`${origin}/?error=google-signin-failed`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/supplier-callback?next=${encodeURIComponent(returnPath)}`,
    },
  });
  if (error || !data.url) return NextResponse.redirect(`${origin}${returnPath}?error=google-signin-failed`);
  return NextResponse.redirect(data.url);
}
