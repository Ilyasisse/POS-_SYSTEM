import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canTransferOpenOrder } from "../../src/lib/cashier/order-handoff";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("an unpaid open order can move to a different waiter", () => {
  assert.equal(
    canTransferOpenOrder({
      status: "OPEN",
      paymentCount: 0,
      currentWaiterId: "waiter-1",
      targetWaiterId: "waiter-2",
    }),
    true,
  );
});

test("closed, paid, unassigned, and same-waiter transfers are blocked", () => {
  assert.equal(
    canTransferOpenOrder({
      status: "CLOSED",
      paymentCount: 0,
      currentWaiterId: "waiter-1",
      targetWaiterId: "waiter-2",
    }),
    false,
  );
  assert.equal(
    canTransferOpenOrder({
      status: "OPEN",
      paymentCount: 1,
      currentWaiterId: "waiter-1",
      targetWaiterId: "waiter-2",
    }),
    false,
  );
  assert.equal(
    canTransferOpenOrder({
      status: "OPEN",
      paymentCount: 0,
      currentWaiterId: null,
      targetWaiterId: "waiter-2",
    }),
    false,
  );
  assert.equal(
    canTransferOpenOrder({
      status: "OPEN",
      paymentCount: 0,
      currentWaiterId: "waiter-1",
      targetWaiterId: "waiter-1",
    }),
    false,
  );
});

test("handoff action rechecks state, restricts the target, and writes an audit", () => {
  const action = source("src/app/manager/waiter-orders/actions.ts");
  assert.match(action, /requirePermission\(PERMISSIONS\.ORDER_MANAGE\)/);
  assert.match(action, /role: "WAITER", isActive: true/);
  assert.match(action, /payments: \{ none: \{\} \}/);
  assert.match(action, /order\.waiter\.transferred/);
});
