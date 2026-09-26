import assert from "node:assert/strict";
import test from "node:test";
import { searchMenuProducts } from "../../src/lib/menu/menu-search";

const products = [
  { name: "Iced Latte", description: "Cold espresso", categoryName: "Coffee" },
  { name: "Tea", description: "Hot drink", categoryName: "Drinks" },
  {
    name: "Coffee Cake",
    description: "Fresh pastry",
    categoryName: "Desserts",
  },
];

test("menu search spans category, name and description while preserving product order", () => {
  assert.deepEqual(searchMenuProducts(products, " COFFEE "), [
    products[0],
    products[2],
  ]);
  assert.deepEqual(searchMenuProducts(products, "espresso"), [products[0]]);
  assert.deepEqual(searchMenuProducts(products, "tea"), [products[1]]);
  assert.deepEqual(searchMenuProducts(products, ""), products);
  assert.deepEqual(searchMenuProducts(products, "not on menu"), []);
});
