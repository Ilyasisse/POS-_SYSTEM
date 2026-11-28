import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import * as React from "react";
import { jsx } from "react/jsx-runtime";
import ts from "typescript";
import type { MenuCategory, MenuData, MenuProduct } from "../../src/types/menu/menu-types";

function product(id: string): MenuProduct {
  return {
    id,
    name: id,
    description: "",
    price: 1,
    imageUrl: null,
    categoryName: "",
    categorySlug: "",
    isPopular: false,
    bestSellerScore: 0,
  };
}

function mount(categories: MenuCategory[]) {
  let state: unknown;
  const runtime = ts.transpileModule(readFileSync("src/components/menu/MenuShowcase.tsx", "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const dependencies: Record<string, unknown> = {
    react: {
      useReducer: (
        reducer: (state: unknown, action: unknown) => unknown,
        initial: string,
        initialize: (value: string) => unknown,
      ) => {
        state ??= initialize(initial);
        return [
          state,
          (action: unknown) => {
            state = reducer(state, action);
          },
        ];
      },
    },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: React.Fragment },
    "next/link": (props: Record<string, unknown>) => jsx("a", props),
    "@/components/ui/button": {
      Button: (props: Record<string, unknown>) =>
        jsx("button", Object.fromEntries(Object.entries(props).filter(([name]) => name !== "key"))),
    },
    "@/components/menu/MenuProductCard": ({ product }: { product: MenuProduct }) =>
      jsx("article", { "data-product-id": product.id }),
    "@/components/menu/FeaturedCard": () => null,
  };
  const exports: Record<string, unknown> = {};
  vm.runInNewContext(runtime, { exports, require: (name: string) => dependencies[name], Set });
  const Component = exports.default as (props: { data: MenuData }) => React.ReactNode;
  const data: MenuData = {
    cafeName: "",
    heroImage: "",
    categories,
    products: categories.flatMap((category) => category.products),
    featuredItems: [],
    hasLiveData: true,
  };

  function expand(value: React.ReactNode): React.ReactElement<Record<string, unknown>>[] {
    if (Array.isArray(value)) return value.flatMap(expand);
    if (!React.isValidElement<Record<string, unknown>>(value)) return [];
    if (typeof value.type === "function") {
      return expand(
        (value.type as (props: Record<string, unknown>) => React.ReactNode)(value.props),
      );
    }
    return [value, ...expand(value.props.children as React.ReactNode)];
  }
  const render = () => expand(Component({ data }));
  const text = (value: React.ReactNode): string => {
    if (Array.isArray(value)) return value.map(text).join("");
    if (React.isValidElement<Record<string, unknown>>(value))
      return text(value.props.children as React.ReactNode);
    return typeof value === "string" || typeof value === "number" ? String(value) : "";
  };
  return {
    productIds: () =>
      render()
        .filter((node) => node.type === "article")
        .map((node) => node.props["data-product-id"]),
    click(label: string) {
      const button = render().find(
        (node) =>
          node.type === "button" && text(node.props.children as React.ReactNode).trim() === label,
      );
      assert.ok(button, "Expected button " + label);
      assert.equal(typeof button.props.onClick, "function");
      (button.props.onClick as () => void)();
    },
  };
}

test("category names with equal or empty slugs remain independently selectable", () => {
  const categories = [
    { id: "one", name: "Fast Food", slug: "fast-food", products: [product("first")] },
    { id: "two", name: "Fast-Food", slug: "fast-food", products: [product("second")] },
    { id: "three", name: "شاي", slug: "", products: [product("third")] },
  ];
  const menu = mount(categories);
  assert.deepEqual(menu.productIds(), ["first"]);
  menu.click("Fast-Food");
  assert.deepEqual(menu.productIds(), ["second"]);
  menu.click("شاي");
  assert.deepEqual(menu.productIds(), ["third"]);
  const firstHasEmptySlug = mount([categories[2], categories[0]]);
  assert.deepEqual(firstHasEmptySlug.productIds(), ["third"]);
});

test("load-more counts belong to category IDs and survive switching categories", () => {
  const items = Array.from({ length: 12 }, (_, index) => product("item-" + index));
  const menu = mount([
    { id: "one", name: "Coffee", slug: "", products: items },
    { id: "two", name: "Tea", slug: "", products: [product("tea")] },
  ]);
  assert.equal(menu.productIds().length, 10);
  menu.click("Load More");
  assert.equal(menu.productIds().length, 12);
  menu.click("Tea");
  assert.deepEqual(menu.productIds(), ["tea"]);
  menu.click("Coffee");
  assert.equal(menu.productIds().length, 12);
});
