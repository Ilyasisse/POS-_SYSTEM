import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getOutstandingOrderTotal } from "../../src/lib/waiter/assigned-orders";

test("assigned table balance subtracts partial payments and never goes negative", () => {
  assert.equal(
    getOutstandingOrderTotal(18.5, [
      { amountPaid: 5 },
      { amountPaid: 3.25 },
    ]),
    10.25,
  );
  assert.equal(getOutstandingOrderTotal(5, [{ amountPaid: 6 }]), 0);
});

test("waiter page only loads open orders assigned to the signed-in waiter", () => {
  const page = readFileSync(
    new URL("../../src/app/waiter/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /requirePermission\(PERMISSIONS\.ORDER_VIEW_ASSIGNED\)/);
  assert.match(page, /waiterId: currentUser\.id/);
  assert.match(page, /status: "OPEN"/);
  assert.match(page, /assignedOrders=\{assignedOrders\}/);
});
