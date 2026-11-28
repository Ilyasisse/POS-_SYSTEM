import assert from "node:assert/strict";
import test from "node:test";
import {
  groupMenuCategories,
  type MenuProduct,
} from "../../src/lib/menu/menu-data";
import { validateProductModifierSelection } from "../../src/lib/products/modifier-selection";

function menuProduct(
  id: string,
  categoryName: string,
  categorySlug: string,
): MenuProduct {
  return {
    id,
    name: id,
    categoryName,
    categorySlug,
    description: "",
    imageUrl: null,
    price: 5,
    isPopular: false,
    bestSellerScore: 0,
  };
}
const milkRule = {
  id: "milk",
  name: "Milk",
  isRequired: true,
  minSelect: 1,
  maxSelect: 1,
};
const milkOptions = [
  { id: "oat", isActive: true, modifierGroup: milkRule },
  { id: "whole", isActive: true, modifierGroup: milkRule },
];

test("public menu follows the saved category order even when product ranking differs", () => {
  const products = [
    menuProduct("Popular coffee", "Coffee", "coffee"),
    menuProduct("Tea", "Tea", "tea"),
    menuProduct("Cake", "Desserts", "desserts"),
    menuProduct("Second coffee", "Coffee", "coffee"),
  ];
  const categories = groupMenuCategories(products, [
    "desserts",
    "tea",
    "coffee",
  ]);
  assert.deepEqual(
    categories.map((category) => category.name),
    ["Desserts", "Tea", "Coffee"],
  );
  assert.deepEqual(
    categories[2].products.map((product) => product.id),
    ["Popular coffee", "Second coffee"],
  );
});

test("menu grouping omits categories without products and handles a new category", () => {
  const categories = groupMenuCategories(
    [
      menuProduct("Juice", "Juices", "juices"),
      menuProduct("Tea", "Tea", "tea"),
    ],
    ["empty", "tea", "juices"],
  );
  assert.deepEqual(
    categories.map((category) => category.slug),
    ["tea", "juices"],
  );
});

test("required exactly-one rules reject both missing and excessive choices", () => {
  assert.match(
    validateProductModifierSelection("Latte", milkOptions, []) ?? "",
    /choose exactly 1 from Milk/,
  );
  assert.match(
    validateProductModifierSelection("Latte", milkOptions, [
      { modifierId: "oat" },
      { modifierId: "whole" },
    ]) ?? "",
    /choose exactly 1/,
  );
  assert.equal(
    validateProductModifierSelection("Latte", milkOptions, [
      { modifierId: "oat" },
    ]),
    null,
  );
});

test("optional rules accept no selection and enforce the maximum", () => {
  const optional = milkOptions.map((option) => ({
    ...option,
    modifierGroup: { ...milkRule, isRequired: false, minSelect: 0 },
  }));
  assert.equal(validateProductModifierSelection("Latte", optional, []), null);
  assert.match(
    validateProductModifierSelection("Latte", optional, [
      { modifierId: "oat" },
      { modifierId: "whole" },
    ]) ?? "",
    /choose up to 1/,
  );
});

test("minimum and maximum rules apply independently to each linked group", () => {
  const extras = ["cream", "syrup", "cocoa"].map((id) => ({
    id,
    isActive: true,
    modifierGroup: {
      id: "extras",
      name: "Extras",
      isRequired: true,
      minSelect: 2,
      maxSelect: 3,
    },
  }));
  const options = [...milkOptions, ...extras];
  assert.match(
    validateProductModifierSelection("Latte", options, [
      { modifierId: "oat" },
      { modifierId: "cream" },
    ]) ?? "",
    /choose 2–3 from Extras/,
  );
  assert.equal(
    validateProductModifierSelection("Latte", options, [
      { modifierId: "oat" },
      { modifierId: "cream" },
      { modifierId: "cocoa" },
    ]),
    null,
  );
});

test("a modifier linked to another product cannot satisfy this product's group", () => {
  assert.match(
    validateProductModifierSelection("Latte", milkOptions, [
      { modifierId: "another-products-oat" },
    ]) ?? "",
    /no longer available for Latte/,
  );
});

test("inactive choices and fabricated placeholder choices are rejected", () => {
  assert.match(
    validateProductModifierSelection(
      "Latte",
      [{ ...milkOptions[0], isActive: false }],
      [{ modifierId: "oat" }],
    ) ?? "",
    /no longer available/,
  );
  assert.match(
    validateProductModifierSelection("Latte", milkOptions, [
      { modifierId: "placeholder__free" },
    ]) ?? "",
    /no longer available/,
  );
});

test("a required group with no active options remains required", () => {
  assert.match(
    validateProductModifierSelection(
      "Latte",
      milkOptions.map((option) => ({ ...option, isActive: false })),
      [],
    ) ?? "",
    /choose exactly 1/,
  );
});

test("duplicate modifier ids do not count as distinct choices", () => {
  const twoRequired = milkOptions.map((option) => ({
    ...option,
    modifierGroup: { ...milkRule, minSelect: 2, maxSelect: 2 },
  }));
  assert.match(
    validateProductModifierSelection("Latte", twoRequired, [
      { modifierId: "oat" },
      { modifierId: "oat" },
    ]) ?? "",
    /choose exactly 2/,
  );
});

test("option quantities must be bounded positive whole numbers", () => {
  for (const qty of [0, -1, 1.5, NaN, Infinity, 1001]) {
    assert.match(
      validateProductModifierSelection("Latte", milkOptions, [
        { modifierId: "oat", qty },
      ]) ?? "",
      /Invalid option quantity/,
    );
  }
  assert.equal(
    validateProductModifierSelection("Latte", milkOptions, [
      { modifierId: "oat", qty: 1 },
    ]),
    null,
  );
});

test("unconfigured products accept an empty selection", () => {
  assert.equal(validateProductModifierSelection("Tea", [], []), null);
});
