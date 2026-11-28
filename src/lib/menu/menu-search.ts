import type { MenuProduct } from "@/types/menu/menu-types";

type SearchableProduct = Pick<MenuProduct, "name" | "description" | "categoryName">;

export function searchMenuProducts<T extends SearchableProduct>(
  products: readonly T[],
  query: string,
): T[] {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return [...products];

  return products.filter((product) =>
    [product.name, product.description, product.categoryName].some((value) =>
      value.toLocaleLowerCase().includes(term),
    ),
  );
}
