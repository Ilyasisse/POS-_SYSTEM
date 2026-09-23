import assert from "node:assert/strict";
import test from "node:test";
import { rankWaiterSales } from "../../src/lib/reports/waiter-sales";

test("groups paid orders by waiter id, including unassigned orders, and sums cents exactly", () => {
  assert.deepEqual(
    rankWaiterSales([
      { waiterId: "one", waiter: "Ali", total: "1.05" },
      { waiterId: "one", waiter: "Ali", total: "2.10" },
      { waiterId: "two", waiter: "Ali", total: "4.00" },
      { waiterId: null, waiter: null, total: "0.99" },
    ]),
    [
      { id: "two", name: "Ali", orders: 1, grossOrderValue: "4.00" },
      { id: "one", name: "Ali", orders: 2, grossOrderValue: "3.15" },
      {
        id: "unassigned",
        name: "Unassigned",
        orders: 1,
        grossOrderValue: "0.99",
      },
    ],
  );
});
