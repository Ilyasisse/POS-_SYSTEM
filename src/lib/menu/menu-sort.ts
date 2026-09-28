import type { MenuProduct } from "./menu-data";

export type MenuSort = "menu" | "price-low" | "price-high" | "name";

export function sortMenuProducts<T extends Pick<MenuProduct, "name" | "price">>(
  products: readonly T[],
  sort: MenuSort,
): T[] {
  if (sort === "menu") return [...products];

  return products
    .map((product, index) => ({ product, index }))
    .sort((a, b) => {
      const difference =
        sort === "price-low"
          ? a.product.price - b.product.price
          : sort === "price-high"
            ? b.product.price - a.product.price
            : a.product.name.localeCompare(b.product.name);
      return difference || a.index - b.index;
    })
    .map(({ product }) => product);
}
