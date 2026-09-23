import assert from "node:assert/strict";
import test from "node:test";
import {
  parseParLevel,
  quantityToPar,
} from "../../src/lib/inventory/par-levels";

test("par targets must exceed the warning threshold without rounding inputs", () => {
  assert.equal(parseParLevel("2.000001", "2").ok, true);
  for (const input of [
    "0",
    "2",
    "-1",
    "2.0000009",
    "1e3",
    "9999999999999",
    "abc",
  ])
    assert.equal(parseParLevel(input, "2").ok, false, input);
  assert.deepEqual(parseParLevel(" ", "2"), { ok: true, value: null });
});

test("refill suggestion never goes below zero and preserves fractional units", () => {
  assert.equal(quantityToPar("3.125", "5.000")?.toString(), "1.875");
  assert.equal(quantityToPar("7", "5")?.toString(), "0");
  assert.equal(quantityToPar("3", null), null);
});
