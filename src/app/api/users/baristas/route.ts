import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 60;

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
      take: 50,
    });

    return NextResponse.json(baristas, { status: 200 });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Failed to fetch baristas:", error);
    }

    return NextResponse.json(
      { error: "Failed to fetch baristas" },
      { status: 500 }
    );
  }
}