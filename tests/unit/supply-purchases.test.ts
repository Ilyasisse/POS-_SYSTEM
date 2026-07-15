import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateSupplyDayTotal,
  calculateSupplyLineTotal,
  getTodaySupplyDateKey,
  isValidSupplyDateKey,
  parseSupplyPurchaseInput,
  resolveSupplyDateKey,
  supplyDateKeyToDatabaseDate,
} from "../../src/lib/supplies/supply-purchases";

function purchaseFormData(values: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

test("uses the Nairobi calendar date for new Supply entries", () => {
  assert.equal(
    getTodaySupplyDateKey(new Date("2026-07-12T22:30:00.000Z")),
    "2026-07-13",
  );
});

test("accepts only real calendar dates and stores them at UTC midnight", () => {
  assert.equal(isValidSupplyDateKey("2026-02-29"), false);
  assert.equal(isValidSupplyDateKey("2028-02-29"), true);
  assert.equal(
    supplyDateKeyToDatabaseDate("2026-07-13")?.toISOString(),
    "2026-07-13T00:00:00.000Z",
  );
});

test("defaults invalid and future selected dates to today", () => {
  const now = new Date("2026-07-13T10:00:00.000Z");
  assert.equal(resolveSupplyDateKey("bad-date", now), "2026-07-13");
  assert.equal(resolveSupplyDateKey("2026-07-14", now), "2026-07-13");
  assert.equal(resolveSupplyDateKey("2026-07-12", now), "2026-07-12");
});

test("validates decimal quantities and unit prices", () => {
  const now = new Date("2026-07-13T10:00:00.000Z");
  const valid = parseSupplyPurchaseInput(
    purchaseFormData({
      itemName: "  Milk  ",
      purchaseDate: "2026-07-13",
      quantity: "2.5",
      unitPrice: "1.20",
    }),
    now,
  );
  assert.equal(valid.ok, true);
  if (valid.ok) assert.equal(valid.value.itemName, "Milk");

  assert.deepEqual(
    parseSupplyPurchaseInput(
      purchaseFormData({
        itemName: "Milk",
        purchaseDate: "2026-07-13",
        quantity: "1.2345",
        unitPrice: "1.20",
      }),
      now,
    ),
    { ok: false, status: "invalid_entry" },
  );
});

test("rounds each Supply line before calculating the daily total", () => {
  assert.equal(calculateSupplyLineTotal("1.005", "1").toString(), "1.01");
  assert.equal(
    calculateSupplyDayTotal([
      { quantity: "1.005", unitPrice: "1" },
      { quantity: "1.005", unitPrice: "1" },
    ]).toString(),
    "2.02",
  );
});
