import { NextResponse } from "next/server";
import { findAppUser } from "@/lib/auth/app-user";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const appUser = await findAppUser(user.id);

    if (!appUser) {
      return NextResponse.json(
        { error: "User account not found" },
        { status: 404 },
      );
    }

    if (!appUser.isActive) {
      return NextResponse.json(
        { error: "User account is inactive" },
        { status: 403 },
      );
    }

    return NextResponse.json({
      id: appUser.id,
      fullName: appUser.fullName,
      role: appUser.role,
      station: appUser.station,
      isActive: appUser.isActive,
    });
  } catch (error) {
    console.error("GET /api/me error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
