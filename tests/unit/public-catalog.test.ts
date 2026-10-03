import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load<T>(path: string, dependencies: Record<string, unknown>): T {
  const output = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, {
    exports,
    require: (name: string) => dependencies[name] ?? {},
    console,
    process,
  });
  return exports as T;
}

for (const popular of [false, true]) {
  test(`${popular ? "popular" : "all"} public products omit costs and inactive categories/modifier groups`, async () => {
    const prisma = {
      product: {
        findMany: async (input: {
          where: { category: { isActive: boolean }; isPopular?: boolean };
          select: {
            cost?: boolean;
            modifiers: { where: { modifierGroup: { isActive: boolean } } };
          };
        }) => {
          assert.equal(input.where.category.isActive, true);
          assert.equal(input.where.isPopular, popular ? true : undefined);
          assert.equal(input.select.cost, undefined);
          assert.equal(
            input.select.modifiers.where.modifierGroup.isActive,
            true,
          );
          return [
            {
              id: "tea",
              name: "Tea",
              price: "2.50",
              stockQty: "3.00",
              modifiers: [
                {
                  id: "milk",
                  name: "Milk",
                  price: "0.50",
                  pronunciationAudioUrl: null,
                  modifierGroup: {
                    id: "group",
                    name: "Extras",
                    isRequired: false,
                    minSelect: 0,
                    maxSelect: 2,
                  },
                },
              ],
            },
          ];
        },
      },
    };
    const dependencies = {
      "@/lib/prisma": { prisma },
      "@/lib/products/availability": { availableForSaleWhere: () => ({}) },
      "next/server": { NextResponse: { json: (body: unknown) => body } },
    };
    const catalog = load<{
      getPublicProducts: (popular?: boolean) => Promise<unknown>;
    }>("src/lib/products/public-catalog.ts", dependencies);
    const route = load<{
      GET: () => Promise<
        { price: number; modifierGroups: { options: { price: number }[] }[] }[]
      >;
    }>(`src/app/api/GET/Product/${popular ? "" : "all/"}route.ts`, {
      ...dependencies,
      "@/lib/products/public-catalog": catalog,
    });
    const products = await route.GET();
    assert.equal("cost" in products[0], false);
    assert.equal(products[0].price, 2.5);
    assert.equal(products[0].modifierGroups[0].options[0].price, 0.5);
  });
}
