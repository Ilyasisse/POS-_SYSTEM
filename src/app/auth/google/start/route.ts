import { NextResponse } from "next/server";

import { parseCustomerReturnPath } from "@/lib/auth/customer-return-path";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const redirectOrigin = requestUrl.origin;
  const customerDestination = parseCustomerReturnPath(requestUrl.searchParams.get("next"));
  const callbackUrl = new URL("/auth/callback", redirectOrigin);
  if (customerDestination) callbackUrl.searchParams.set("next", customerDestination);
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
    if (customerDestination) loginUrl.searchParams.set("next", customerDestination);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(data.url);
}
