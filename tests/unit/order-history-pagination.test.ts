import assert from "node:assert/strict";
import test from "node:test";
import {
  ORDER_HISTORY_PAGE_SIZE,
  orderHistoryPage,
} from "../../src/lib/admin/order-history-pagination";

test("order pages select stable offsets and visible bounds", () => {
  assert.deepEqual(orderHistoryPage("2", ORDER_HISTORY_PAGE_SIZE + 3), {
    page: 2,
    pageCount: 2,
    skip: ORDER_HISTORY_PAGE_SIZE,
    first: ORDER_HISTORY_PAGE_SIZE + 1,
    last: ORDER_HISTORY_PAGE_SIZE + 3,
  });
  assert.equal(orderHistoryPage("99", ORDER_HISTORY_PAGE_SIZE + 3).page, 2);
});

test("invalid pages and empty results resolve to the first page", () => {
  for (const page of ["-1", "0", "1.5", "oops", "9999999999999999999"]) {
    assert.equal(orderHistoryPage(page, 25).page, 1);
  }
  assert.deepEqual(orderHistoryPage("9", 0), {
    page: 1,
    pageCount: 1,
    skip: 0,
    first: 0,
    last: 0,
  });
});
