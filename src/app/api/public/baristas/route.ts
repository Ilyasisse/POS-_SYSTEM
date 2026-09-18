import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Public order configuration needs names and IDs only. */
export async function GET() {
  try {
    const baristas = await prisma.staff.findMany({
      where: { role: "BARISTA", isActive: true },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
      take: 50,
    });
    return NextResponse.json(baristas);
  } catch (error) {
    console.error("Failed to load public baristas:", error);
    return NextResponse.json(
      { error: "Baristas are unavailable." },
      { status: 500 },
    );
  }
}
