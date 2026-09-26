import assert from "node:assert/strict";
import test from "node:test";
import { parseCashCount } from "../../src/lib/cashier/cash-count";

test("accepts exact opening and closing counts including zero", () => {
  assert.equal(parseCashCount("0"), "0");
  assert.equal(parseCashCount("1000000.00"), "1000000.00");
});

test("rejects imprecise, negative, or oversized cash counts", () => {
  for (const count of [
    "-1",
    "1.234",
    "1000000.01",
    "1e2",
    " 2",
    "",
    "Infinity",
  ]) {
    assert.equal(parseCashCount(count), null, count);
  }
});
