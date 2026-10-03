import { NextResponse } from "next/server";
import { getPublicProducts } from "@/lib/products/public-catalog";

export const revalidate = 300;

export async function GET() {
  try {
    return NextResponse.json(await getPublicProducts());
  } catch (error) {
    if (process.env.NODE_ENV !== "production")
      console.error("GET /api/products error:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 },
    );
  }
}
