import assert from "node:assert/strict";
import test from "node:test";
import { filterOccupiedTables } from "../../src/lib/cashier/occupied-table-search";

const tables = [
  { name: "Patio 3", orders: [{ orderNumber: 101 }, { orderNumber: 103 }] },
  { name: "Main 1", orders: [{ orderNumber: 102 }] },
];

test("cashier finds occupied tables by name or exact open order number", () => {
  assert.deepEqual(filterOccupiedTables(tables, " PATIO "), [tables[0]]);
  assert.deepEqual(filterOccupiedTables(tables, "#102"), [tables[1]]);
  assert.deepEqual(filterOccupiedTables(tables, "101"), [tables[0]]);
  assert.deepEqual(filterOccupiedTables(tables, "10"), []);
  assert.deepEqual(filterOccupiedTables(tables, ""), tables);
});
