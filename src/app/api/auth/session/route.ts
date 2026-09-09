import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ authenticated: false });
  }

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, fullName: true, role: true },
  });

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
