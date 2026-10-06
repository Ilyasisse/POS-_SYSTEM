import assert from "node:assert/strict";
import test from "node:test";
import {
  runHistoryPage,
  runHistoryParams,
} from "../../src/lib/supplier-orders/run-history-browser";

test("supplier run history validates status and bounds paging", () => {
  assert.deepEqual(runHistoryParams("FAILED", "4"), {
    status: "FAILED",
    page: 4,
  });
  assert.deepEqual(runHistoryParams("invalid", "-1"), {
    status: "ALL",
    page: 1,
  });
  assert.deepEqual(runHistoryPage(8, 51), { page: 3, pages: 3 });
  assert.deepEqual(runHistoryPage(5, 0), { page: 1, pages: 1 });
});
