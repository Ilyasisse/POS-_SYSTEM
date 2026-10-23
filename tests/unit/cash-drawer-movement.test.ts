import assert from "node:assert/strict";
import test from "node:test";
import { parseCashDrawerMovement } from "../../src/lib/cashier/cash-drawer-movement";

const valid = {
  direction: "OUT",
  amount: "12.50",
  reason: "Change for the till",
  idempotencyKey: "bd9db55c-9a1a-4233-a123-27e9d56ef2bc",
};

test("accepts a valid movement with an exact two-decimal amount", () => {
  assert.deepEqual(parseCashDrawerMovement(valid), valid);
  assert.equal(
    parseCashDrawerMovement({ ...valid, reason: "  Till float  " })?.reason,
    "Till float",
  );
});

test("rejects negative, zero, oversized, or imprecise money", () => {
  for (const amount of ["0", "-2", "1.001", "1000000.01", "1e2", "Infinity"]) {
    assert.equal(parseCashDrawerMovement({ ...valid, amount }), null, amount);
  }
});

test("rejects missing reasons, unknown directions, and malformed retry keys", () => {
  assert.equal(
    parseCashDrawerMovement({ ...valid, direction: "REFUND" }),
    null,
  );
  assert.equal(parseCashDrawerMovement({ ...valid, reason: "  " }), null);
  assert.equal(
    parseCashDrawerMovement({ ...valid, reason: "a".repeat(251) }),
    null,
  );
  assert.equal(
    parseCashDrawerMovement({ ...valid, idempotencyKey: "repeat" }),
    null,
  );
});
