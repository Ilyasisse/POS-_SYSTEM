import { NextResponse } from "next/server";
import { getPublicProducts } from "@/lib/products/public-catalog";

export async function GET() {
  try {
    return NextResponse.json(await getPublicProducts(true));
  } catch (error) {
    console.error("GET /api/GET/Product error:", error);
    return NextResponse.json(
      { error: "Failed to fetch active products" },
      { status: 500 },
    );
  }
}
