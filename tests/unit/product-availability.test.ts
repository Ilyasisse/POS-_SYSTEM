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
