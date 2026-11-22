import { expect, test } from "@jest/globals";

import {
  availabilityRestorationTime,
  isProductAvailableForSale,
} from "../../src/lib/products/availability";

const now = new Date("2026-08-30T12:00:00.000Z");

test("keeps normally available products for sale", () => {
  expect(
    isProductAvailableForSale({ availableForSale: true, availabilityRestoresAt: null }, now),
  ).toBe(true);
});

test("blocks indefinite and future temporary outages", () => {
  expect(
    isProductAvailableForSale({ availableForSale: false, availabilityRestoresAt: null }, now),
  ).toBe(false);
  expect(
    isProductAvailableForSale(
      {
        availableForSale: false,
        availabilityRestoresAt: new Date("2026-08-30T13:00:00.000Z"),
      },
      now,
    ),
  ).toBe(false);
});

test("automatically restores an expired temporary outage", () => {
  expect(
    isProductAvailableForSale(
      {
        availableForSale: false,
        availabilityRestoresAt: new Date("2026-08-30T11:59:59.000Z"),
      },
      now,
    ),
  ).toBe(true);
});

test("calculates timed restoration without inventing an indefinite date", () => {
  expect(availabilityRestorationTime(180, now)?.toISOString()).toBe("2026-08-30T15:00:00.000Z");
  expect(availabilityRestorationTime(null, now)).toBe(null);
});
