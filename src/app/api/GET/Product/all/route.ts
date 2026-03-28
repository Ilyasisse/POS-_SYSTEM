import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            station: true,
          },
        },
        modifiers: {
          where: {
            isActive: true,
          },
          include: {
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
      const groupMap = new Map<
        string,
        {
          id: string;
          name: string;
          required: boolean;
          minSelect: number;
          maxSelect: number;
          multiple: boolean;
          options: {
            id: string;
            name: string;
            price: number;
            pronunciationAudioUrl: string | null;
          }[];
        }
      >();

      for (const modifier of product.modifiers ?? []) {
        const group = modifier.modifierGroup;

        if (!group) {
          continue;
        }

        if (!groupMap.has(group.id)) {
          groupMap.set(group.id, {
            id: group.id,
            name: group.name,
            required: Boolean(group.isRequired),
            minSelect: Number(group.minSelect ?? 0),
            maxSelect: Number(group.maxSelect ?? 1),
            multiple: Number(group.maxSelect ?? 1) > 1,
            options: [],
          });
        }

        groupMap.get(group.id)?.options.push({
          id: modifier.id,
          name: modifier.name,
          price: Number(modifier.price ?? 0),
          pronunciationAudioUrl: modifier.pronunciationAudioUrl ?? null,
        });
      }

      return {
        id: product.id,
        name: product.name,
        price: Number(product.price ?? 0),
        cost: product.cost != null ? Number(product.cost) : null,
        isActive: product.isActive,
        sku: product.sku ?? null,
        description: product.description ?? null,
        trackStock: Boolean(product.trackStock),
        stockQty: Number(product.stockQty ?? 0),
        imageUrl: product.imageUrl ?? null,
        pronunciationAudioUrl: product.pronunciationAudioUrl ?? null,
        isPopular: Boolean(product.isPopular),
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
    console.error("GET /api/GET/Product/all error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch active products",
      },
      { status: 500 }
    );
  }
}
