import assert from "node:assert/strict";
import test from "node:test";
import {
  MOVEMENT_HISTORY_PAGE_SIZE,
  movementHistoryPage,
} from "../../src/lib/inventory/movement-history-page";

test("stock movement history reaches older rows without invalid offsets", () => {
  assert.deepEqual(movementHistoryPage("2", MOVEMENT_HISTORY_PAGE_SIZE + 5), {
    page: 2,
    pageCount: 2,
    skip: MOVEMENT_HISTORY_PAGE_SIZE,
  });
  assert.equal(movementHistoryPage("100", 35).page, 2);
  for (const invalid of ["0", "-1", "1.5", "abc", "9999999999999999999"]) {
    assert.equal(movementHistoryPage(invalid, 35).page, 1);
  }
  assert.deepEqual(movementHistoryPage("9", 0), {
    page: 1,
    pageCount: 1,
    skip: 0,
  });
});
