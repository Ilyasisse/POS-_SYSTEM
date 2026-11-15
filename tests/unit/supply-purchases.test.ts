import { expect, test } from "@jest/globals";

import {
  calculateSupplyDayTotal,
  calculateSupplyLineTotal,
  getTodaySupplyDateKey,
  isValidSupplyDateKey,
  parseSupplyUnitPrice,
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
  expect(getTodaySupplyDateKey(new Date("2026-07-12T22:30:00.000Z"))).toBe("2026-07-13");
});

test("accepts only real calendar dates and stores them at UTC midnight", () => {
  expect(isValidSupplyDateKey("2026-02-29")).toBe(false);
  expect(isValidSupplyDateKey("2028-02-29")).toBe(true);
  expect(supplyDateKeyToDatabaseDate("2026-07-13")?.toISOString()).toBe("2026-07-13T00:00:00.000Z");
});

test("defaults invalid and future selected dates to today", () => {
  const now = new Date("2026-07-13T10:00:00.000Z");
  expect(resolveSupplyDateKey("bad-date", now)).toBe("2026-07-13");
  expect(resolveSupplyDateKey("2026-07-14", now)).toBe("2026-07-13");
  expect(resolveSupplyDateKey("2026-07-12", now)).toBe("2026-07-12");
});

test("validates decimal quantities and unit prices", () => {
  const now = new Date("2026-07-13T10:00:00.000Z");
  const valid = parseSupplyPurchaseInput(
    purchaseFormData({
      catalogItemId: "milk-id",
      purchaseDate: "2026-07-13",
      quantity: "2.5",
      unitPrice: "0.0742",
    }),
    now,
  );
  expect(valid.ok).toBe(true);
  if (valid.ok) {
    expect(valid.value.catalogItemId).toBe("milk-id");
    expect(valid.value.unitPrice.toString()).toBe("0.0742");
  }

  expect(
    parseSupplyPurchaseInput(
      purchaseFormData({
        catalogItemId: "milk-id",
        purchaseDate: "2026-07-13",
        quantity: "1.2345",
        unitPrice: "1.20",
      }),
      now,
    ),
  ).toStrictEqual({ ok: false, status: "invalid_entry" });
});

test("accepts up to four decimal places for Supply unit prices", () => {
  for (const value of ["0", "0.07", "0.074", "0.0742"]) {
    expect(parseSupplyUnitPrice(value)?.toString()).toBe(String(Number(value)));
  }

  for (const value of ["-0.0742", "0.07421", ".0742", "1.", "not-a-price"]) {
    expect(parseSupplyUnitPrice(value)).toBe(null);
  }
});

test("rounds each Supply line before calculating the daily total", () => {
  expect(calculateSupplyLineTotal("1.005", "1").toString()).toBe("1.01");
  expect(calculateSupplyLineTotal("100", "0.0742").toString()).toBe("7.42");
  expect(
    calculateSupplyDayTotal([
      { quantity: "1.005", unitPrice: "1" },
      { quantity: "1.005", unitPrice: "1" },
    ]).toString(),
  ).toBe("2.02");
});
