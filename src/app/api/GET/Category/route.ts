import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const category = await prisma.category.findMany()
    return NextResponse.json(category)
  } catch (error) {
    console.error("API ERROR:", error)
    return NextResponse.json(
      { error: "Failed to fetch category" },
      { status: 500 }
    )
  }
}