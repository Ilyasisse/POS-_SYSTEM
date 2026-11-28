import { availableForSaleWhere } from "@/lib/products/availability";
import {
  getPublicProductImageUrl,
  PRODUCT_FALLBACK_IMAGE_URL,
} from "@/lib/products/product-images";
import type { MenuData, MenuProduct } from "@/types/menu/menu-types";
import { MENU_CAFE_NAME, MENU_HERO_IMAGE } from "./menu-config";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function compareProducts(left: MenuProduct, right: MenuProduct) {
  return (
    right.bestSellerScore - left.bestSellerScore ||
    Number(right.isPopular) - Number(left.isPopular) ||
    left.name.localeCompare(right.name)
  );
}

async function loadLiveMenuData(): Promise<MenuData | null> {
  if (!process.env.DATABASE_URL) return null;

  try {
    const { prisma } = await import("@/lib/prisma");
    const availability = availableForSaleWhere(new Date());
    const categoriesResult = await prisma.category.findMany({
      where: {
        isActive: true,
        products: { some: { isActive: true, ...availability } },
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        products: {
          where: { isActive: true, ...availability },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            imageUrl: true,
            isPopular: true,
          },
        },
      },
    });
    const productIds = categoriesResult.flatMap((category) =>
      category.products.map((product) => product.id),
    );
    if (productIds.length === 0) return null;

    const bestSellerRows = await prisma.orderItem.groupBy({
      by: ["productId"],
      where: { productId: { in: productIds }, order: { status: "PAID" } },
      _sum: { qty: true },
    });
    const scores = new Map(bestSellerRows.map((row) => [row.productId, Number(row._sum.qty ?? 0)]));
    const categories = categoriesResult.map((category) => {
      const slug = slugify(category.name);
      const products = category.products
        .map(
          (product) =>
            ({
              id: product.id,
              name: product.name,
              description: product.description?.trim() || "NOTHING FOUND",
              price: Number(product.price),
              categoryName: category.name,
              categorySlug: slug,
              imageUrl: getPublicProductImageUrl(product.imageUrl) ?? PRODUCT_FALLBACK_IMAGE_URL,
              isPopular: product.isPopular,
              bestSellerScore: scores.get(product.id) ?? 0,
            }) satisfies MenuProduct,
        )
        .sort(compareProducts);
      return { id: category.id, name: category.name, slug, products };
    });
    const products = categories.flatMap((category) => category.products).sort(compareProducts);
    // Do not backfill featured items when a stronger signal has fewer than four.
    const featuredSource = products.some((product) => product.bestSellerScore > 0)
      ? products.filter((product) => product.bestSellerScore > 0)
      : products.some((product) => product.isPopular)
        ? products.filter((product) => product.isPopular)
        : products;

    return {
      cafeName: MENU_CAFE_NAME,
      heroImage: MENU_HERO_IMAGE,
      categories,
      products,
      featuredItems: featuredSource.slice(0, 4),
      hasLiveData: true,
    };
  } catch (error) {
    console.error("Failed to load live menu data", error);
    return null;
  }
}

export async function getMenuData(): Promise<MenuData> {
  const liveData = await loadLiveMenuData();
  return liveData
    ? liveData
    : {
        cafeName: MENU_CAFE_NAME,
        heroImage: MENU_HERO_IMAGE,
        categories: [],
        products: [],
        featuredItems: [],
        hasLiveData: false,
      };
}
