import { NextResponse } from "next/server";

export function middleware() {
  return NextResponse.next();
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
