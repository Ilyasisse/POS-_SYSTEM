import { NextResponse } from "next/server";

import { findAppUser } from "@/lib/auth/app-user";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ authenticated: false });
  }

  const profile = await findAppUser(user.id);

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: profile?.email ?? user.email,
      name: profile?.fullName,
      role: profile?.role,
    },
  });
}
