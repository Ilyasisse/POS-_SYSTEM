import assert from "node:assert/strict";
import test from "node:test";
import {
  createHeldOrderDraft,
  parseHeldOrderDrafts,
  restoreHeldOrderDraft,
} from "../../src/lib/cashier/held-order-drafts";
import type { CartLine, Product } from "../../src/lib/types";

const product: Product = {
  id: "burger",
  name: "Chicken burger",
  price: 3,
  isPopular: false,
  category: { id: "food", name: "Food", station: "FAST_FOOD" },
  modifierGroups: [{
    id: "size",
    name: "Size",
    required: true,
    multiple: false,
    options: [{ id: "large", name: "Large", price: 1 }],
  }],
};

const cartLine: CartLine = {
  cartKey: "old-key",
  id: product.id,
  name: product.name,
  product,
  price: 2,
  finalPrice: 2.5,
  quantity: 2,
  selectedModifiers: [{
    groupId: "size", groupName: "Old size", optionId: "large",
    optionName: "Old large", price: 0.5, qty: 1,
  }],
  station: "FAST_FOOD",
};

function draft() {
  return createHeldOrderDraft({
    id: "draft-1",
    label: "  Amina  ",
    tableId: "table-1",
    tableName: "Table 1",
    orderNote: "  no onions  ",
    savedAt: "2026-09-14T08:00:00.000Z",
    cart: [cartLine],
  });
}

test("stores only a compact validated order snapshot", () => {
  const saved = draft();
  assert.equal(saved.label, "Amina");
  assert.equal(saved.orderNote, "no onions");
  assert.deepEqual(saved.items, [{
    productId: "burger", quantity: 2, modifierOptionIds: ["large"], assignedUserId: null,
  }]);
});

test("restores current product and modifier prices", () => {
  const restored = restoreHeldOrderDraft(draft(), [product], []);
  assert.equal(restored.skippedItems, 0);
  assert.equal(restored.cart[0]?.finalPrice, 4);
  assert.equal(restored.cart[0]?.lineTotal, 8);
  assert.equal(restored.cart[0]?.selectedModifiers[0]?.optionName, "Large");
});

test("skips unavailable products and invalid current configurations", () => {
  assert.deepEqual(restoreHeldOrderDraft(draft(), [], []), { cart: [], skippedItems: 1 });
  const changed = { ...product, modifierGroups: [{ ...product.modifierGroups![0]!, options: [] }] };
  assert.deepEqual(restoreHeldOrderDraft(draft(), [changed], []), { cart: [], skippedItems: 1 });
});

test("rejects corrupt or oversized browser storage", () => {
  assert.deepEqual(parseHeldOrderDrafts("not json"), []);
  assert.deepEqual(parseHeldOrderDrafts(JSON.stringify([{ bad: true }])), []);
  assert.deepEqual(parseHeldOrderDrafts(JSON.stringify(Array.from({ length: 21 }, () => draft()))), []);
  assert.equal(parseHeldOrderDrafts(JSON.stringify([draft()])).length, 1);
});
