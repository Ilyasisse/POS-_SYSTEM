import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const LOCAL_CUSTOMER_ORIGIN = "http://localhost:3000";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  let next = requestUrl.searchParams.get("next") ?? "/menu";

  if (!next.startsWith("/")) {
    next = "/menu";
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      if (next === "/menu") {
        return NextResponse.redirect(`${LOCAL_CUSTOMER_ORIGIN}${next}`);
      }

      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";

      if (!isLocalEnv && forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      }

      return NextResponse.redirect(`${requestUrl.origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${requestUrl.origin}/login?error=google-signin-failed`,
  );
}
