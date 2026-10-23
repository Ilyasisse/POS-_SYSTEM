import assert from "node:assert/strict";
import test from "node:test";
import {
  getSupplierOverdueCutoff,
  isSupplierPurchaseOrderOverdue,
} from "../../src/lib/suppliers/purchase-orders";

test("uses the café calendar date instead of the UTC date", () => {
  const now = new Date("2026-09-23T22:30:00Z");
  assert.equal(
    getSupplierOverdueCutoff(now).toISOString(),
    "2026-09-24T00:00:00.000Z",
  );
  assert.equal(
    isSupplierPurchaseOrderOverdue(
      {
        status: "OPEN",
        expectedDeliveryDate: new Date("2026-09-23T00:00:00Z"),
      },
      now,
    ),
    true,
  );
  assert.equal(
    isSupplierPurchaseOrderOverdue(
      {
        status: "OPEN",
        expectedDeliveryDate: new Date("2026-09-24T00:00:00Z"),
      },
      now,
    ),
    false,
  );
});

test("completed and cancelled purchase orders cannot be overdue", () => {
  const now = new Date("2026-09-24T06:00:00Z");
  for (const status of ["COMPLETED", "CANCELLED"])
    assert.equal(
      isSupplierPurchaseOrderOverdue(
        { status, expectedDeliveryDate: new Date("2026-09-21T00:00:00Z") },
        now,
      ),
      false,
    );
});
