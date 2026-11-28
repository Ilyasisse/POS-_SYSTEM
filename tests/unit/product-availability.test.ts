import assert from "node:assert/strict";
import test from "node:test";

import {
  formatAvailabilityMinute,
  getNairobiMinuteOfDay,
  isProductAvailableAt,
  parseProductAvailabilityInput,
} from "../../src/lib/menu/product-availability";

test("resolves Nairobi time independently of the server timezone", () => {
  assert.equal(getNairobiMinuteOfDay(new Date("2026-09-01T05:30:00Z")), 510);
});

test("supports daytime windows with an exclusive closing boundary", () => {
  const product = {
    availabilityStartMinute: 7 * 60,
    availabilityEndMinute: 11 * 60,
  };
  assert.equal(isProductAvailableAt(product, new Date("2026-09-01T05:30:00Z")), true);
  assert.equal(isProductAvailableAt(product, new Date("2026-09-01T08:00:00Z")), false);
});

test("supports windows that cross midnight", () => {
  const product = {
    availabilityStartMinute: 18 * 60,
    availabilityEndMinute: 2 * 60,
  };
  assert.equal(isProductAvailableAt(product, new Date("2026-09-01T19:30:00Z")), true);
  assert.equal(isProductAvailableAt(product, new Date("2026-09-01T04:00:00Z")), false);
});

test("parses scheduled and always-available form values", () => {
  assert.deepEqual(
    parseProductAvailabilityInput({ mode: "SCHEDULED", start: "06:30", end: "12:00" }),
    { availabilityStartMinute: 390, availabilityEndMinute: 720 },
  );
  assert.deepEqual(parseProductAvailabilityInput({ mode: "ALWAYS" }), {
    availabilityStartMinute: null,
    availabilityEndMinute: null,
  });
  assert.equal(formatAvailabilityMinute(390), "06:30");
  assert.throws(
    () => parseProductAvailabilityInput({ mode: "SCHEDULED", start: "08:00", end: "08:00" }),
    /different/,
  );
});
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
