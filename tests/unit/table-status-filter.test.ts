import assert from "node:assert/strict";
import test from "node:test";
import {
  filterTables,
  parseTableView,
  tableStatus,
} from "../../src/lib/tables/table-status-filter";

const tables = [
  { name: "Patio 1", isActive: true, orders: [] },
  { name: "Patio 2", isActive: true, orders: [{ id: 1 }] },
  { name: "Storage", isActive: false, orders: [] },
  { name: "Old booth", isActive: false, orders: [{ id: 2 }] },
];

test("table status respects hidden tables even if an old order is open", () => {
  assert.equal(tableStatus(tables[3]), "hidden");
  assert.deepEqual(filterTables(tables, " patio ", "available"), [tables[0]]);
  assert.deepEqual(filterTables(tables, "PATIO", "occupied"), [tables[1]]);
  assert.deepEqual(filterTables(tables, "", "hidden"), tables.slice(2));
  assert.deepEqual(filterTables(tables, "no match", "all"), []);
});

test("unknown status query falls back to all", () => {
  assert.equal(parseTableView("occupied"), "occupied");
  assert.equal(parseTableView("not-a-status"), "all");
});
