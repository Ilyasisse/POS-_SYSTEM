import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { availableForSaleWhere } from "@/lib/products/availability";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: {
        isPopular: true,
        isActive: true,
        ...availableForSaleWhere(),
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
      type ModifierGroup = {
        id: string;
        name: string;
        required: boolean;
        minSelect: number;
        maxSelect: number;
        multiple: boolean;
        options: Array<{
          id: string;
          name: string;
          price: number;
        }>;
      };
      // Keep this as a plain request-local index; Map#set in GET handlers
      // is flagged as a side effect even when it only shapes the response.
      const modifierGroupsById: Record<string, ModifierGroup> = {};
      const modifierGroups: ModifierGroup[] = [];

      for (const modifier of product.modifiers) {
        const group = modifier.modifierGroup;
        let existingGroup = modifierGroupsById[group.id];

        if (!existingGroup) {
          existingGroup = {
            id: group.id,
            name: group.name,
            required: group.isRequired,
            minSelect: group.minSelect,
            maxSelect: group.maxSelect,
            multiple: group.maxSelect > 1,
            options: [],
          };
          modifierGroupsById[group.id] = existingGroup;
          modifierGroups.push(existingGroup);
        }

        existingGroup.options.push({
          id: modifier.id,
          name: modifier.name,
          price: Number(modifier.price),
        });
      }

      return {
        ...product,
        price: Number(product.price),
        cost: product.cost ? Number(product.cost) : null,
        modifierGroups,
      };
    });

    return NextResponse.json(formattedProducts);
  } catch (error) {
    console.error("GET /api/GET/Product error:", error);

    return NextResponse.json(
      { error: "Failed to fetch active products" },
      { status: 500 },
    );
  }
}
