import { NextResponse } from "next/server";

import { getDefaultRouteForUser } from "@/lib/auth/get-default-route-for-user";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    password?: unknown;
  } | null;
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return NextResponse.json(
      { error: error?.message || "Login failed." },
      { status: 401 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: data.user.id },
    select: {
      role: true,
      station: true,
      isActive: true,
    },
  });

  if (!user) {
    await supabase.auth.signOut();

    return NextResponse.json(
      { error: "Unable to find your staff account." },
      { status: 404 },
    );
  }

  if (!user.isActive) {
    await supabase.auth.signOut();

    return NextResponse.json(
      { error: "Your staff account is inactive." },
      { status: 403 },
    );
  }

  if (user.role === "CUSTOMER") {
    await supabase.auth.signOut();

    return NextResponse.json(
      { error: "Customer accounts should use the customer login page." },
      { status: 403 },
    );
  }

  return NextResponse.json({ redirectTo: getDefaultRouteForUser(user) });
}
