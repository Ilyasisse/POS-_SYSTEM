import type { Category, Product } from "@/lib/types";

export const CUSTOMER_MENU_CACHE_KEY = "mashallah.customer-menu.v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function serializeCustomerMenu(
  productsAll: Product[],
  categories: Category[],
  now = Date.now(),
) {
  return JSON.stringify({ version: 1, savedAt: now, productsAll, categories });
}

export function parseCustomerMenuCache(
  raw: string | null,
  now = Date.now(),
): {
  productsAll: Product[];
  categories: Category[];
} | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const cache = value as Record<string, unknown>;
    if (
      cache.version !== 1 ||
      typeof cache.savedAt !== "number" ||
      !Number.isFinite(cache.savedAt) ||
      cache.savedAt > now ||
      now - cache.savedAt > MAX_AGE_MS ||
      !Array.isArray(cache.productsAll) ||
      !Array.isArray(cache.categories) ||
      cache.productsAll.length > 5000 ||
      cache.categories.length > 500
    )
      return null;
    if (
      !cache.productsAll.every(
        (product: unknown) =>
          product &&
          typeof product === "object" &&
          typeof (product as Record<string, unknown>).id === "string" &&
          typeof (product as Record<string, unknown>).name === "string" &&
          ["number", "string"].includes(
            typeof (product as Record<string, unknown>).price,
          ),
      ) ||
      !cache.categories.every(
        (category: unknown) =>
          category &&
          typeof category === "object" &&
          typeof (category as Record<string, unknown>).id === "string" &&
          typeof (category as Record<string, unknown>).name === "string",
      )
    )
      return null;
    return {
      productsAll: cache.productsAll as Product[],
      categories: cache.categories as Category[],
    };
  } catch {
    return null;
  }
}
