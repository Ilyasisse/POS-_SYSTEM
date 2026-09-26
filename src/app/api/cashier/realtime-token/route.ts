import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const staff = await prisma.staff.findUnique({
    where: { id: user.id },
    select: { role: true, isActive: true },
  });
  if (!staff?.isActive || !hasPermission(staff, PERMISSIONS.ORDER_MANAGE)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  // getUser above verifies the identity before this session token is returned.
  const {
    data: { session: currentSession },
  } = await supabase.auth.getSession();
  const session =
    currentSession?.expires_at &&
    currentSession.expires_at * 1000 - Date.now() < 120_000
      ? (await supabase.auth.refreshSession()).data.session
      : currentSession;
  if (!session || session.user.id !== user.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json(
    { token: session.access_token, expiresAt: session.expires_at ?? null },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
