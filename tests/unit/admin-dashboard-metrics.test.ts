import { test } from "node:test";
import assert from "node:assert/strict";
import {
  outstandingBalance,
  dashboardRange,
  paymentChart,
} from "../../src/lib/admin/dashboard-metrics";

test("partial payments reduce debt; overpayments never offset another order", () => {
  assert.equal(
    outstandingBalance([
      { total: "20.00", payments: [{ amountPaid: "5.25" }] },
      { total: "5.00", payments: [{ amountPaid: "10.00" }] },
      { total: "0.30", payments: [{ amountPaid: "0.10" }, { amountPaid: "0.20" }] },
    ]).toFixed(2),
    "14.75",
  );
  assert.equal(outstandingBalance([]).toFixed(2), "0.00");
});
test("period defaults safely and overnight belongs to the prior business day", () => {
  const now = new Date("2026-10-25T23:30:00Z");
  const today = dashboardRange(undefined, now);
  assert.deepEqual(dashboardRange("invalid", now), today);
  assert.equal(today.start.toISOString(), "2026-10-25T04:00:00.000Z");
  assert.equal(today.end.toISOString(), "2026-10-26T02:00:00.000Z");
  assert.ok(dashboardRange("week", now).start < today.start);
});
test("chart includes overnight payments but excludes closing gap and end boundary", () => {
  const points = paymentChart(
    [
      { createdAt: new Date("2026-10-24T04:00:00Z"), amountPaid: "10.10" },
      { createdAt: new Date("2026-10-25T01:59:59Z"), amountPaid: "2.20" },
      { createdAt: new Date("2026-10-25T02:00:00Z"), amountPaid: "100" },
      { createdAt: new Date("2026-10-25T03:00:00Z"), amountPaid: "100" },
      { createdAt: new Date("2026-10-25T04:00:00Z"), amountPaid: "3.30" },
    ],
    new Date("2026-10-25T09:00:00Z"),
  );
  assert.equal(points.length, 7);
  assert.deepEqual(points.slice(0, 2), [
    { label: "Sat", value: 12.3 },
    { label: "Sun", value: 3.3 },
  ]);
});
