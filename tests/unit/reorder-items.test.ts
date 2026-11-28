import assert from "node:assert/strict";
import test from "node:test";
import { buildReorderLines } from "../../src/lib/orders/reorder-items";
import type { Product } from "../../src/lib/types";

const product: Product = {
  id: "coffee",
  name: "Coffee",
  price: 2,
  isPopular: true,
  category: { id: "drinks", name: "Drinks", station: "BARISTA" },
  modifierGroups: [{
    id: "milk",
    name: "Milk",
    required: false,
    multiple: false,
    options: [{ id: "oat", name: "Oat", price: 0.5 }],
  }],
};

test("rebuilds previous items with current prices and modifier names", () => {
  const result = buildReorderLines(
    [{ productId: "coffee", qty: 2, assignedUserId: "barista-1", modifiers: [{ modifierId: "oat", qty: 1 }] }],
    [product],
    [{ id: "barista-1", fullName: "Amina", role: "BARISTA" }],
  );
  assert.equal(result.unavailableItems, 0);
  assert.equal(result.lines[0]?.quantity, 2);
  assert.equal(result.lines[0]?.finalPrice, 2.5);
  assert.equal(result.lines[0]?.assignedUserName, "Amina");
  assert.equal(result.lines[0]?.selectedModifiers[0]?.optionName, "Oat");
});

test("skips inactive products or removed modifiers", () => {
  assert.deepEqual(
    buildReorderLines(
      [{ productId: "missing", qty: 2, assignedUserId: null, modifiers: [] }],
      [product],
      [],
    ),
    { lines: [], unavailableItems: 2 },
  );
  const removedModifier = buildReorderLines(
    [{ productId: "coffee", qty: 1, assignedUserId: null, modifiers: [{ modifierId: "removed", qty: 1 }] }],
    [product],
    [],
  );
  assert.equal(removedModifier.lines.length, 0);
  assert.equal(removedModifier.unavailableItems, 1);
});
