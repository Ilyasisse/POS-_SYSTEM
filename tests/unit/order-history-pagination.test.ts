import assert from "node:assert/strict";
import test from "node:test";
import {
  orderHistoryPage,
  parseOrderHistorySearch,
} from "../../src/lib/admin/order-history-pagination";

test("order number lookup accepts receipt-style numbers but rejects invalid and overflowing input", () => {
  assert.equal(parseOrderHistorySearch(" #123 "), 123);
  assert.equal(parseOrderHistorySearch("123"), 123);
  assert.equal(parseOrderHistorySearch("coffee"), null);
  assert.equal(parseOrderHistorySearch("0"), null);
  assert.equal(parseOrderHistorySearch("2147483648"), null);
});

test("history pages clamp invalid requests and the last partial page", () => {
  assert.equal(orderHistoryPage("3", 45, 20), 3);
  assert.equal(orderHistoryPage("999", 45, 20), 3);
  assert.equal(orderHistoryPage("-1", 45, 20), 1);
  assert.equal(orderHistoryPage("2.5", 45, 20), 1);
  assert.equal(orderHistoryPage(undefined, 0, 20), 1);
});
