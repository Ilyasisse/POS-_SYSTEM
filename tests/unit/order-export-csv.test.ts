import assert from "node:assert/strict";
import test from "node:test";
import { toOrderHistoryCsv } from "../../src/lib/admin/order-export-csv";

test("order history export has stable headers, quotes and neutralizes spreadsheet formulas", () => {
  const csv = toOrderHistoryCsv([
    {
      orderNumber: 42,
      createdAt: new Date("2026-09-26T04:00:00Z"),
      status: "PAID",
      type: "DINE_IN",
      total: "12.50",
      tableName: '=HYPERLINK("https://example.com")',
      cashierName: "=2+2",
      waiterName: null,
      itemCount: 2,
    },
  ]);
  assert.match(
    csv,
    /^Order Number,Created At \(UTC\),Status,Type,Total \(USD\),Table,Cashier,Waiter,Item Count\r\n/,
  );
  assert.match(csv, /"'=HYPERLINK\(""https:\/\/example.com""\)"/);
  assert.match(csv, /"'=2\+2"/);
  assert.match(csv, /"12.50"/);
});
