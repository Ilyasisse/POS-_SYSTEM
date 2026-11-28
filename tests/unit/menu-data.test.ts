import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

type Product = {
  id: string;
  name: string;
  isPopular: boolean;
  description: string;
  price: string;
  imageUrl: string | null;
};
type Category = { id: string; name: string; products: Product[] };
type SalesRow = { productId: string; _sum: { qty: number } };
type Query = {
  where: { isActive: boolean; products: { some: Availability } };
  orderBy: { name: string };
  select: { products: { where: Availability } };
};
type Availability = {
  isActive: boolean;
  OR: [{ availableForSale: boolean }, { availabilityRestoresAt: { lte: Date } }];
};
type SalesQuery = {
  where: { productId: { in: string[] }; order: { status: string } };
  take?: number;
};
type MenuProduct = Omit<Product, "price"> & { price: number };
type Result = {
  products: MenuProduct[];
  featuredItems: MenuProduct[];
  categories: { id: string; slug: string }[];
  hasLiveData: boolean;
  heroImage: string;
};

function fixture(
  categories: Category[],
  rows: SalesRow[] = [],
  options: { database?: boolean; fail?: boolean } = {},
) {
  const calls: { categories?: Query; sales?: SalesQuery } = {};
  const prisma = {
    category: {
      findMany: async (args: Query) => {
        calls.categories = args;
        if (options.fail) throw new Error("database unavailable");
        return categories;
      },
    },
    orderItem: {
      groupBy: async (args: SalesQuery) => {
        calls.sales = args;
        return rows;
      },
    },
  };
  const output = ts.transpileModule(readFileSync("src/lib/menu/menu-data.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: Record<string, unknown> = {};
  const dependencies: Record<string, unknown> = {
    "@/lib/prisma": { prisma },
    "@/lib/products/availability": {
      availableForSaleWhere: (now: Date) => ({
        OR: [{ availableForSale: true }, { availabilityRestoresAt: { lte: now } }],
      }),
    },
    "@/lib/products/product-images": {
      getPublicProductImageUrl: (url: string | null) => url,
      PRODUCT_FALLBACK_IMAGE_URL: "/fallback.webp",
    },
    "./menu-config": { MENU_CAFE_NAME: "Maash Allah Cafe", MENU_HERO_IMAGE: "/menu-hero-bg.webp" },
  };
  vm.runInNewContext(output, {
    exports,
    require: (name: string) => dependencies[name],
    Date,
    process: { env: { DATABASE_URL: options.database === false ? "" : "test" } },
    console: { error: () => {} },
  });
  return { getMenuData: exports.getMenuData as () => Promise<Result>, calls };
}

function product(id: string, name = id, isPopular = false) {
  return { id, name, isPopular, description: " ", price: "2.50", imageUrl: null };
}
const category = (id: string, name: string, products: Product[]) => ({ id, name, products });
const sales = (productId: string, qty: number) => ({ productId, _sum: { qty } });
const ids = (products: { id: string }[]) => Array.from(products, (item) => item.id);

test("loads eligible categories and ranks every paid sales group", async () => {
  const products = Array.from({ length: 10 }, (_, i) => product(`p${i}`, `Name ${i}`, i === 0));
  const f = fixture(
    [category("real-id", "Fast Food", products), category("other-id", "Tea", [product("tea")])],
    [...products.map((p, i) => sales(p.id, i + 1)), sales("tea", 1)],
  );
  const data = await f.getMenuData();
  assert.deepEqual(ids(data.products).slice(0, 4), ["p9", "p8", "p7", "p6"]);
  assert.deepEqual(ids(data.featuredItems), ["p9", "p8", "p7", "p6"]);
  assert.equal(data.categories[0].id, "real-id");
  assert.equal(data.categories[0].slug, "fast-food");
  assert.equal(data.categories[1].id, "other-id");
  assert.equal(data.products[0].price, 2.5);
  assert.equal(data.products[0].description, "NOTHING FOUND");
  assert.equal(data.products[0].imageUrl, "/fallback.webp");
  assert.ok(f.calls.categories);
  assert.equal(f.calls.categories.orderBy.name, "asc");
  assert.ok(f.calls.sales);
  const outer = f.calls.categories.where.products.some;
  const inner = f.calls.categories.select.products.where;
  assert.equal(outer.isActive, true);
  assert.equal(inner.isActive, true);
  assert.equal(outer.OR[1].availabilityRestoresAt.lte, inner.OR[1].availabilityRestoresAt.lte);
  assert.equal(f.calls.sales.where.order.status, "PAID");
  assert.deepEqual(Array.from(f.calls.sales.where.productId.in), [
    ...products.map((p) => p.id),
    "tea",
  ]);
  assert.equal(f.calls.sales.take, undefined);
});

test("sorts ties by popularity then name and preserves featured fallback stages", async () => {
  const entries = [product("z", "Zebra"), product("b", "Beta", true), product("a", "Alpha", true)];
  const withSales = await fixture(
    [category("id", "Coffee", entries)],
    [sales("z", 1)],
  ).getMenuData();
  assert.deepEqual(ids(withSales.products), ["z", "a", "b"]);
  assert.deepEqual(ids(withSales.featuredItems), ["z"]);
  const popular = await fixture([category("id", "Coffee", entries)]).getMenuData();
  assert.deepEqual(ids(popular.featuredItems), ["a", "b"]);
  const noSignal = await fixture([
    category(
      "id",
      "Coffee",
      entries.map((p) => ({ ...p, isPopular: false })),
    ),
  ]).getMenuData();
  assert.deepEqual(ids(noSignal.featuredItems), ["a", "b", "z"]);
});

test("returns empty data for missing configuration, empty results, or errors", async () => {
  for (const f of [
    fixture([], [], { database: false }),
    fixture([]),
    fixture([], [], { fail: true }),
  ]) {
    const data = await f.getMenuData();
    assert.equal(data.hasLiveData, false);
    assert.equal(data.heroImage, "/menu-hero-bg.webp");
    assert.equal(data.categories.length, 0);
    assert.equal(data.products.length, 0);
    assert.equal(data.featuredItems.length, 0);
    assert.equal(f.calls.sales, undefined);
  }
});
