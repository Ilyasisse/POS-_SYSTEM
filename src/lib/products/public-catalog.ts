import { prisma } from "@/lib/prisma";
import { availableForSaleWhere } from "@/lib/products/availability";

/** Only select fields used by public and staff ordering clients. */
export async function getPublicProducts(popularOnly = false) {
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(popularOnly ? { isPopular: true } : {}),
      category: { isActive: true },
      ...availableForSaleWhere(),
    },
    select: {
      id: true,
      name: true,
      price: true,
      isActive: true,
      description: true,
      trackStock: true,
      stockQty: true,
      imageUrl: true,
      pronunciationAudioUrl: true,
      isPopular: true,
      category: { select: { id: true, name: true, station: true } },
      modifiers: {
        where: { isActive: true, modifierGroup: { isActive: true } },
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
    orderBy: { name: "asc" },
  });
  return products.map((product) => {
    type Group = {
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
    };
    const groups: Record<string, Group> = {};
    for (const modifier of product.modifiers) {
      const group = modifier.modifierGroup;
      const entry = (groups[group.id] ??= {
        id: group.id,
        name: group.name,
        required: group.isRequired,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        multiple: group.maxSelect > 1,
        options: [],
      });
      entry.options.push({
        id: modifier.id,
        name: modifier.name,
        price: Number(modifier.price),
        pronunciationAudioUrl: modifier.pronunciationAudioUrl,
      });
    }
    return {
      ...product,
      price: Number(product.price),
      stockQty: Number(product.stockQty),
      modifiers: product.modifiers.map((modifier) => ({
        ...modifier,
        price: Number(modifier.price),
      })),
      modifierGroups: Object.values(groups),
    };
  });
}
