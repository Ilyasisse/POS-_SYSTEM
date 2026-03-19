import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const baristas = await prisma.user.findMany({
      where: {
        role: "BARISTA",
        isActive: true,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        station: true,
      },
      orderBy: {
        fullName: "asc",
      },
    });

    return NextResponse.json(baristas);
  } catch (error) {
    console.error("Failed to fetch baristas:", error);
    return NextResponse.json(
      { error: "Failed to fetch baristas" },
      { status: 500 },
    );
  }
}
