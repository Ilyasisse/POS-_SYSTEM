import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
      },
      include: {
        category: true,
        modifiers: {
          where: {
            isActive: true,
          },
          include: {
            modifierGroup: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    const formattedProducts = products.map((product) => {
      const groupMap = new Map();

      for (const modifier of product.modifiers) {
        const group = modifier.modifierGroup;

        if (!groupMap.has(group.id)) {
          groupMap.set(group.id, {
            id: group.id,
            name: group.name,
            required: group.isRequired,
            minSelect: group.minSelect,
            maxSelect: group.maxSelect,
            multiple: group.maxSelect > 1,
            options: [],
          });
        }

        groupMap.get(group.id).options.push({
          id: modifier.id,
          name: modifier.name,
          price: Number(modifier.price),
        });
      }

      return {
        ...product,
        price: Number(product.price),
        cost: product.cost ? Number(product.cost) : null,
        modifierGroups: Array.from(groupMap.values()),
      };
    });

    return NextResponse.json(formattedProducts);
  } catch (error) {
    console.error("GET /api/GET/Product error:", error);

    return NextResponse.json(
      { error: "Failed to fetch active products" },
      { status: 500 }
    );
  }
}