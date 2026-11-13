import assert from "node:assert/strict";
import test from "node:test";
import {
  summarizeBillStatusGroups,
  supplierBillReportWhere,
} from "../../src/lib/suppliers/bill-report-summary";

test("payment status narrows the same bill rows used for totals", () => {
  const from = new Date("2026-09-01T00:00:00Z");
  const to = new Date("2026-09-30T23:59:59Z");
  const dueCutoff = new Date("2026-10-01T00:00:00Z");
  assert.deepEqual(
    supplierBillReportWhere({
      supplierId: "supplier-1",
      selectedStatus: "PARTIAL",
      dueThroughTomorrow: false,
      dueCutoff,
      from,
      to,
    }),
    {
      supplierId: "supplier-1",
      status: "PARTIAL",
      createdAt: { gte: from, lte: to },
    },
  );
  assert.deepEqual(
    supplierBillReportWhere({
      dueThroughTomorrow: true,
      dueCutoff,
      from,
      to,
    }),
    {
      supplierId: undefined,
      status: { in: ["UNPAID", "PARTIAL"] },
      dueDate: { lte: dueCutoff },
    },
  );
});

test("bill summary includes all status groups and excludes settled balances", () => {
  assert.deepEqual(
    summarizeBillStatusGroups([
      {
        status: "UNPAID",
        _count: { _all: 550 },
        _sum: { totalAmount: "550.00", paidAmount: "0.00" },
      },
      {
        status: "PARTIAL",
        _count: { _all: 1 },
        _sum: { totalAmount: "10.00", paidAmount: "4.00" },
      },
      {
        status: "PAID",
        _count: { _all: 1 },
        _sum: { totalAmount: "5.00", paidAmount: "5.00" },
      },
    ]),
    { unpaid: 556, paid: 9, count: 552 },
  );
  assert.deepEqual(summarizeBillStatusGroups([]), {
    unpaid: 0,
    paid: 0,
    count: 0,
  });
});
