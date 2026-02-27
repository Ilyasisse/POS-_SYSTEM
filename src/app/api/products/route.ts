import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [categories, defaultTax] = await Promise.all([
      prisma.category.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
          products: {
            where: { isActive: true },
            orderBy: { name: "asc" },
          },
        },
      }),
      prisma.taxRate.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const normalizedCategories = categories.map((category) => ({
      id: category.id,
      name: category.name,
      products: category.products.map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku ?? "",
        priceCents: product.priceCents,
      })),
    }));

    return NextResponse.json({
      categories: normalizedCategories,
      taxPercent: defaultTax?.percent ?? 0,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to load products.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
