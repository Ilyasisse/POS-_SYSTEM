import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

/** Validates Supabase JWTs and refreshes cookies for protected staff routes. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // getClaims() verifies the JWT without the per-request Auth user lookup when
  // the project uses asymmetric signing keys, while preserving SSR refreshes.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/manager/:path*",
    "/cashier/:path*",
    "/waiter/:path*",
    "/kitchen/:path*",
    "/inventory/:path*",
  ],
};
