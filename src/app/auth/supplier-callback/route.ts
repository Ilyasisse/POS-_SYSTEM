import { NextResponse } from "next/server";
import { syncGoogleCustomer } from "@/lib/auth/sync-google-customer";
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
  if (!returnPath?.startsWith("/supplier/")) return NextResponse.redirect(`${origin}/?error=google-signin-failed`);

  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(`${origin}${returnPath}?error=google-signin-failed`);
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}${returnPath}?error=google-signin-failed`);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}${returnPath}?error=google-signin-failed`);

  try {
    await syncGoogleCustomer(user);
  } catch (syncError) {
    console.error("Supplier Google account sync failed:", syncError);
    return NextResponse.redirect(`${origin}${returnPath}?error=google-signin-failed`);
  }
  return NextResponse.redirect(`${origin}${returnPath}`);
}
