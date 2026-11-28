import assert from "node:assert/strict";
import test from "node:test";
import {
  priceChangeReasonError,
  recordedPrice,
} from "../../src/lib/products/price-history";

test("only changed prices require a meaningful audit reason", () => {
  assert.equal(priceChangeReasonError(false, ""), null);
  assert.match(priceChangeReasonError(true, "  ") ?? "", /Explain/);
  assert.match(priceChangeReasonError(true, "ab") ?? "", /Explain/);
  assert.equal(priceChangeReasonError(true, "New supplier cost"), null);
  assert.match(priceChangeReasonError(true, "x".repeat(301)) ?? "", /Explain/);
});

test("historical price snapshots handle malformed audit entries", () => {
  assert.equal(recordedPrice({ price: "1.235" }), "$1.235");
  assert.equal(recordedPrice({ price: "not a price" }), "—");
  assert.equal(recordedPrice(null), "—");
});
