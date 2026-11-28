import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
export async function GET() {
  const tables = await prisma.table.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(
    { tables },
    { headers: { "Cache-Control": "no-store" } },
  );
}
