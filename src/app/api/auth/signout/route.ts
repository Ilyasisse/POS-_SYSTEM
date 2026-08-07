import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { signOutStaffSession } from "@/lib/auth/signout-session";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return NextResponse.json(
      { error: "Logout is not configured." },
      {
        status: 500,
        headers: { "Cache-Control": "no-store, max-age=0" },
      },
    );
  }

  const [supabase, cookieStore] = await Promise.all([
    createClient(),
    cookies(),
  ]);

  await signOutStaffSession({
    client: supabase,
    cookieStore,
    supabaseUrl,
    onRemoteSignOutError(error) {
      const message =
        error instanceof Error ? error.message : "Unknown Supabase error";
      console.error(
        "Remote Supabase signout failed; the local staff session was cleared.",
        message,
      );
    },
  });

  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
