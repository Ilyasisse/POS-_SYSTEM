import assert from "node:assert/strict";
import test from "node:test";
import { saleAvailabilityWhere } from "../../src/lib/products/availability-filter";

test("for-sale query includes products whose pause has expired", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  assert.deepEqual(saleAvailabilityWhere("for-sale", now), {
    OR: [{ availableForSale: true }, { availabilityRestoresAt: { lte: now } }],
  });
});

test("sold-out query excludes expired pauses and includes indefinite pauses", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  assert.deepEqual(saleAvailabilityWhere("sold-out", now), {
    availableForSale: false,
    OR: [
      { availabilityRestoresAt: null },
      { availabilityRestoresAt: { gt: now } },
    ],
  });
  assert.deepEqual(saleAvailabilityWhere("all", now), {});
});
