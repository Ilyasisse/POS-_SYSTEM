import assert from "node:assert/strict";
import test from "node:test";
import {
  getDefaultDeliveryDates,
  getDeliveryDateBounds,
  summarizeDeliveryLines,
} from "../../src/lib/suppliers/delivery-report";

test("uses café-local midnight bounds, inclusive from and to", () => {
  const range = getDeliveryDateBounds("2026-09-21", "2026-09-22");
  assert.equal(range?.start.toISOString(), "2026-09-20T21:00:00.000Z");
  assert.equal(range?.end.toISOString(), "2026-09-22T21:00:00.000Z");
  assert.equal(getDeliveryDateBounds("2026-02-30", "2026-03-01"), null);
  assert.equal(getDeliveryDateBounds("2026-09-22", "2026-09-21"), null);
});

test("defaults to the last thirty local calendar days", () => {
  assert.deepEqual(getDefaultDeliveryDates(new Date("2026-09-23T22:30:00Z")), {
    from: "2026-08-26",
    to: "2026-09-24",
  });
});

test("compares unlike item units as separate line counts, never summing quantities", () => {
  assert.deepEqual(
    summarizeDeliveryLines([
      { expectedQuantity: "2.5", receivedQuantity: "1" },
      { expectedQuantity: "10", receivedQuantity: "11" },
      { expectedQuantity: "1.000", receivedQuantity: "1" },
    ]),
    { short: 1, extra: 1, matched: 1 },
  );
});
