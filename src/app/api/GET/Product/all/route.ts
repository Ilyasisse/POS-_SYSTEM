import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 300; // cache for 5 minutes

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        price: true,
        cost: true,
        isActive: true,
        description: true,
        trackStock: true,
        stockQty: true,
        imageUrl: true,
        pronunciationAudioUrl: true,
        isPopular: true,

        category: {
          select: {
            id: true,
            name: true,
            station: true,
          },
        },

        modifiers: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            price: true,
            pronunciationAudioUrl: true,
            modifierGroup: {
              select: {
                id: true,
                name: true,
                isRequired: true,
                minSelect: true,
                maxSelect: true,
              },
            },
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
        if (!group) continue;

        let existingGroup = groupMap.get(group.id);

        if (!existingGroup) {
          existingGroup = {
            id: group.id,
            name: group.name,
            required: !!group.isRequired,
            minSelect: group.minSelect ?? 0,
            maxSelect: group.maxSelect ?? 1,
            multiple: (group.maxSelect ?? 1) > 1,
            options: [],
          };
          groupMap.set(group.id, existingGroup);
        }

        existingGroup.options.push({
          id: modifier.id,
          name: modifier.name,
          price: modifier.price ?? 0,
          pronunciationAudioUrl: modifier.pronunciationAudioUrl ?? null,
        });
      }

      return {
        ...product,
        price: product.price ?? 0,
        cost: product.cost ?? null,
        trackStock: !!product.trackStock,
        stockQty: product.stockQty ?? 0,
        isPopular: !!product.isPopular,
        category: product.category
          ? {
              id: product.category.id,
              name: product.category.name,
              station: product.category.station ?? null,
            }
          : null,
        modifierGroups: Array.from(groupMap.values()),
      };
    });

    return NextResponse.json(formattedProducts);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("GET /api/products error:", error);
    }

    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
