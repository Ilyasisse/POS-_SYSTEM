import assert from "node:assert/strict";
import test from "node:test";
import {
  RECEIPT_ARCHIVE_PAGE_SIZE,
  receiptArchiveDateRange,
  receiptArchivePage,
} from "../../src/lib/payments/receipt-archive";

test("archive date selects the café 7 AM to 7 AM receipt window", () => {
  const range = receiptArchiveDateRange("2026-09-28");
  assert.equal(range?.start.toISOString(), "2026-09-28T04:00:00.000Z");
  assert.equal(range?.end.toISOString(), "2026-09-29T04:00:00.000Z");
  assert.equal(receiptArchiveDateRange("2026-02-30"), null);
});

test("archive pages clamp invalid and stale offsets", () => {
  assert.deepEqual(receiptArchivePage("2", RECEIPT_ARCHIVE_PAGE_SIZE + 1), {
    page: 2,
    pageCount: 2,
    skip: RECEIPT_ARCHIVE_PAGE_SIZE,
  });
  assert.equal(receiptArchivePage("900", 31).page, 2);
  assert.equal(receiptArchivePage("-1", 31).page, 1);
  assert.equal(receiptArchivePage("9999999999999999999", 31).page, 1);
});
