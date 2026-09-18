import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Customer orders require verified mobile money checkout." },
    { status: 410 },
  );
}
