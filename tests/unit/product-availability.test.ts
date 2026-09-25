import assert from "node:assert/strict";
import test from "node:test";
import {
  availabilityRestorationTime,
  isProductAvailableForSale,
} from "../../src/lib/products/availability";

const now = new Date("2026-08-30T12:00:00.000Z");

test("keeps normally available products for sale", () => {
  assert.equal(
    isProductAvailableForSale(
      { availableForSale: true, availabilityRestoresAt: null },
      now,
    ),
    true,
  );
});

test("blocks indefinite and future temporary outages", () => {
  assert.equal(
    isProductAvailableForSale(
      { availableForSale: false, availabilityRestoresAt: null },
      now,
    ),
    false,
  );
  assert.equal(
    isProductAvailableForSale(
      {
        availableForSale: false,
        availabilityRestoresAt: new Date("2026-08-30T13:00:00.000Z"),
      },
      now,
    ),
    false,
  );
});

test("automatically restores an expired temporary outage", () => {
  assert.equal(
    isProductAvailableForSale(
      {
        availableForSale: false,
        availabilityRestoresAt: new Date("2026-08-30T11:59:59.000Z"),
      },
      now,
    ),
    true,
  );
});

test("calculates timed restoration without inventing an indefinite date", () => {
  assert.equal(
    availabilityRestorationTime(180, now)?.toISOString(),
    "2026-08-30T15:00:00.000Z",
  );
  assert.equal(availabilityRestorationTime(null, now), null);
});
