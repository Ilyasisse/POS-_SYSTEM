import assert from "node:assert/strict";
import test from "node:test";
import { parseCounterOrderType } from "../../src/lib/orders/counter-order-type";

test("counter sales accept takeaway orders", () => {
  assert.equal(parseCounterOrderType("TAKEOUT"), "TAKEOUT");
  assert.equal(parseCounterOrderType(undefined), "TAKEOUT");
});

test("counter sales reject table and unsupported order types", () => {
  assert.equal(parseCounterOrderType("DINE_IN"), null);
  assert.equal(parseCounterOrderType("DELIVERY"), null);
});
