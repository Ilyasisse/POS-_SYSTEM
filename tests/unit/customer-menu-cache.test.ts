import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCustomerMenuCache,
  serializeCustomerMenu,
} from "../../src/lib/customer/customer-menu-cache";
import type { Category, Product } from "../../src/lib/types";

const products: Product[] = [
  { id: "coffee", name: "Coffee", price: 2.5, isPopular: false },
];
const categories: Category[] = [
  { id: "drinks", name: "Drinks", sortOrder: 1, isActive: true },
];
const now = Date.UTC(2026, 8, 23, 12);

test("recovers a recent saved menu without retaining staff assignments", () => {
  const saved = serializeCustomerMenu(products, categories, now);
  assert.deepEqual(parseCustomerMenuCache(saved, now + 60_000), {
    productsAll: products,
    categories,
  });
  assert.equal(saved.includes("baristas"), false);
});

test("rejects stale, future, malformed, and incompatible saved menus", () => {
  const saved = serializeCustomerMenu(products, categories, now);
  assert.equal(
    parseCustomerMenuCache(saved, now + 24 * 60 * 60 * 1000 + 1),
    null,
  );
  assert.equal(parseCustomerMenuCache(saved, now - 1), null);
  assert.equal(parseCustomerMenuCache("{", now), null);
  assert.equal(
    parseCustomerMenuCache(
      JSON.stringify({
        version: 2,
        savedAt: now,
        productsAll: products,
        categories,
      }),
      now,
    ),
    null,
  );
  assert.equal(
    parseCustomerMenuCache(
      JSON.stringify({
        version: 1,
        savedAt: now,
        productsAll: [{ id: "bad" }],
        categories,
      }),
      now,
    ),
    null,
  );
});
