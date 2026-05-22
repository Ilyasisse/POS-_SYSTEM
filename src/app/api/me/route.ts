import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const appUser = await prisma.user.findUnique({
      where: {
        id: user.id,
      },
      select: {
        id: true,
        fullName: true,
        role: true,
        station: true,
        isActive: true,
      },
    });

    if (!appUser) {
      return NextResponse.json(
        { error: "User account not found" },
        { status: 404 }
      );
    }

    if (!appUser.isActive) {
      return NextResponse.json(
        { error: "User account is inactive" },
        { status: 403 }
      );
    }

    return NextResponse.json(appUser);
  } catch (error) {
    console.error("GET /api/me error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
