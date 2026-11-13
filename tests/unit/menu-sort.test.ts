import assert from "node:assert/strict";
import test from "node:test";
import { sortMenuProducts } from "../../src/lib/menu/menu-sort";

const products = [
  { name: "Tea", price: 3 },
  { name: "Coffee", price: 2 },
  { name: "Cake", price: 3 },
];

test("menu order stays unchanged and sorting does not mutate the menu", () => {
  assert.deepEqual(sortMenuProducts(products, "menu"), products);
  assert.deepEqual(
    products.map((product) => product.name),
    ["Tea", "Coffee", "Cake"],
  );
});

test("price and name sorting retain original order for equal values", () => {
  assert.deepEqual(
    sortMenuProducts(products, "price-low").map((product) => product.name),
    ["Coffee", "Tea", "Cake"],
  );
  assert.deepEqual(
    sortMenuProducts(products, "price-high").map((product) => product.name),
    ["Tea", "Cake", "Coffee"],
  );
  assert.deepEqual(
    sortMenuProducts(products, "name").map((product) => product.name),
    ["Cake", "Coffee", "Tea"],
  );
});
