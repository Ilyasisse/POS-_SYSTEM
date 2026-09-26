import assert from "node:assert/strict";
import test from "node:test";
import {
  isDeliveryOnTime,
  summarizeSupplierDeliveries,
} from "../../src/lib/suppliers/on-time-scorecard";

test("uses the café arrival date against the unshifted expected DATE", () => {
  const expected = new Date("2026-09-25T00:00:00Z");
  assert.equal(
    isDeliveryOnTime(expected, new Date("2026-09-25T20:59:59Z")),
    true,
  );
  assert.equal(
    isDeliveryOnTime(expected, new Date("2026-09-25T21:00:00Z")),
    false,
  );
});

test("does not count missing receiving as a timely delivery", () => {
  const expectedDeliveryDate = new Date("2026-09-25T00:00:00Z");
  const summary = summarizeSupplierDeliveries([
    {
      supplierId: "a",
      supplierName: "Supplier A",
      expectedDeliveryDate,
      receivedAt: new Date("2026-09-25T09:00:00Z"),
    },
    {
      supplierId: "a",
      supplierName: "Supplier A",
      expectedDeliveryDate,
      receivedAt: new Date("2026-09-26T09:00:00Z"),
    },
    {
      supplierId: "a",
      supplierName: "Supplier A",
      expectedDeliveryDate,
      receivedAt: null,
    },
    {
      supplierId: "b",
      supplierName: "Supplier B",
      expectedDeliveryDate,
      receivedAt: null,
    },
  ]);
  assert.deepEqual(
    summary.map(({ name, onTime, late, notRecorded, onTimePercent }) => ({
      name,
      onTime,
      late,
      notRecorded,
      onTimePercent,
    })),
    [
      {
        name: "Supplier A",
        onTime: 1,
        late: 1,
        notRecorded: 1,
        onTimePercent: 50,
      },
      {
        name: "Supplier B",
        onTime: 0,
        late: 0,
        notRecorded: 1,
        onTimePercent: null,
      },
    ],
  );
});
