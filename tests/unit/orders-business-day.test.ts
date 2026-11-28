import assert from "node:assert/strict";
import test from "node:test";
import {
  getOrderBusinessDayRange,
  summarizeOrderBusinessDay,
} from "../../src/lib/admin/orders-business-day";

test("admin order day rolls over at 07:00 Africa/Nairobi", () => {
  const before = getOrderBusinessDayRange(new Date("2026-09-26T03:59:00Z"));
  assert.equal(before.start.toISOString(), "2026-09-25T04:00:00.000Z");
  assert.equal(before.end.toISOString(), "2026-09-26T04:00:00.000Z");
  const after = getOrderBusinessDayRange(new Date("2026-09-26T04:00:00Z"));
  assert.equal(after.start.toISOString(), before.end.toISOString());
});

test("business day paid revenue excludes open and cancelled orders", () => {
  assert.deepEqual(
    summarizeOrderBusinessDay([
      { status: "PAID", total: 18 },
      { status: "OPEN", total: 12 },
      { status: "CANCELLED", total: 50 },
    ]),
    { open: 1, paid: 1, paidRevenue: 18 },
  );
});
