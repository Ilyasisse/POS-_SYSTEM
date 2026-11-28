import assert from "node:assert/strict";
import test from "node:test";
import type { DailyInventoryDigestItem } from "../../src/lib/inventory/inventory-digest";

import { formatDailyInventoryDigestHtml } from "../../src/lib/inventory/inventory-digest";

const base: DailyInventoryDigestItem = {
  id: "item-1",
  name: "Coffee",
  unit: "piece",
  itemType: "Product",
  stockQty: 2,
  lowStockThreshold: 3,
  inventoryAlertStatus: "LOW",
  previousInventoryAlertStatus: "OK",
};

test("daily digest identifies low products and out-of-stock supplies", () => {
  const html = formatDailyInventoryDigestHtml([
    base,
    {
      ...base,
      id: "item-2",
      name: "Milk",
      itemType: "Supply",
      unit: "litre",
      stockQty: 0,
      inventoryAlertStatus: "OUT",
    },
    { ...base, id: "item-3", name: "In stock", inventoryAlertStatus: "OK" },
  ]);

  assert.match(html, /Coffee/);
  assert.match(html, /Milk/);
  assert.match(html, /Product/);
  assert.match(html, /Supply/);
  assert.doesNotMatch(html, /In stock/);
});

test("daily digest escapes inventory names and units", () => {
  const html = formatDailyInventoryDigestHtml([
    { ...base, name: '<img src=x onerror="alert(1)">', unit: "<piece>" },
  ]);

  assert.doesNotMatch(html, /<img/);
  assert.doesNotMatch(html, /<piece>/);
  assert.match(html, /&lt;img/);
});
