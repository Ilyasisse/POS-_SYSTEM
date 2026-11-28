import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import type { Product } from "../../src/lib/types";
import {
  buildModifierLines,
  getProductModifierGroups,
} from "../../src/components/customer/customer-order-utils";

type Element = { type: unknown; props: Record<string, unknown> };

function findElement(value: unknown, type: string): Element | undefined {
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findElement(child, type);
      if (found) return found;
    }
  } else if (value && typeof value === "object") {
    const element = value as Element;
    if (element.type === type) return element;
    return findElement(element.props?.children, type);
  }
}

function orderFixture(baristas: { id: string; fullName: string }[]) {
  const actions: { type: string; product?: Product }[] = [];
  const added: Product[] = [];
  const exports: Record<string, (props: unknown) => unknown> = {};
  const output = ts.transpileModule(
    readFileSync("src/components/cashier/CashierOrderExperience.tsx", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  const dependencies: Record<string, unknown> = {
    react: {
      useState: (value: unknown) => [value, () => undefined],
      useEffect: () => undefined,
      useMemo: (calculate: () => unknown) => calculate(),
      useDeferredValue: (value: unknown) => value,
      useTransition: () => [false, (callback: () => void) => callback()],
      useReducer: (_: unknown, initial: unknown) => [
        initial,
        (action: (typeof actions)[number]) => actions.push(action),
      ],
    },
    "react/jsx-runtime": {
      jsx: (type: unknown, props: Element["props"]) => ({ type, props }),
      jsxs: (type: unknown, props: Element["props"]) => ({ type, props }),
    },
    "next/navigation": { useRouter: () => ({}) },
    "@/components/AosInitializer": { useAos: () => undefined },
    "@/hooks/waiter/useWaiterData": {
      useWaiterData: () => ({ productsAll: [], categories: [], baristas, loading: false }),
    },
    "@/hooks/waiter/useWaiterCart": {
      useWaiterCart: () => ({
        cart: [],
        addToCart: (product: Product) => added.push(product),
        calculateCartTotal: () => 0,
      }),
    },
    "@/components/customer/UI/ProductGridPanel": { default: "ProductGridPanel" },
    "@/components/customer/customer-order-utils": { buildModifierLines, getProductModifierGroups },
  };
  vm.runInNewContext(output, {
    exports,
    require: (name: string) => dependencies[name] ?? {},
  });
  const tree = exports.default({ tables: [{ id: "table", name: "Table 1" }], initialTableId: "table" });
  const grid = findElement(tree, "ProductGridPanel");
  assert.ok(grid);
  return {
    actions,
    added,
    addProduct: grid.props.onProductClick as (product: Product) => void,
  };
}

test("cashier configures a barista drink even when it has no modifier groups", () => {
  const f = orderFixture([{ id: "barista", fullName: "Barista" }]);
  const drink: Product = {
    id: "coffee", name: "Coffee", price: 2, isPopular: false,
    category: { id: "drinks", name: "Drinks", station: "BARISTA" },
    modifierGroups: [],
  };
  f.addProduct(drink);
  assert.equal(f.added.length, 0);
  assert.equal(f.actions[0].type, "modifierOpen");
  assert.equal(f.actions[0].product, drink);

  f.addProduct({ ...drink, id: "water", category: { id: "water", name: "Water", station: "CABITAAN" } });
  assert.equal(f.added.length, 1);
  assert.equal(f.actions.at(-1)?.type, "added");
});

test("cashier blocks barista drinks when no active barista is available", () => {
  const f = orderFixture([]);
  f.addProduct({
    id: "coffee", name: "Coffee", price: 2, isPopular: false,
    category: { id: "drinks", name: "Drinks", station: "BARISTA" },
  });
  assert.equal(f.added.length, 0);
  assert.equal(f.actions[0].type, "failed");
});
