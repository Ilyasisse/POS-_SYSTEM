import assert from "node:assert/strict";
import test from "node:test";
import { summarizeTableSales } from "../../src/lib/reports/table-sales";

test("uses table ids, excludes counter orders, and sums cents exactly", () => {
  assert.deepEqual(
    summarizeTableSales([
      { tableId: "a", table: "Table 1", total: "2.05" },
      { tableId: "a", table: "Table 1", total: "0.10" },
      { tableId: "b", table: "Table 1", total: "3.00" },
      { tableId: null, table: null, total: "20.00" },
    ]),
    {
      withoutTable: 1,
      tables: [
        { id: "b", name: "Table 1", paidOrders: 1, grossOrderValue: "3.00" },
        { id: "a", name: "Table 1", paidOrders: 2, grossOrderValue: "2.15" },
      ],
    },
  );
});
