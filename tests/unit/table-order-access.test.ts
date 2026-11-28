import assert from "node:assert/strict";
import test from "node:test";
import {
  canWaiterUseTable,
  resolveTableOrderAttribution,
  TableOrderOwnershipError,
} from "../../src/lib/orders/table-order-access";

test("only lists free, unassigned, or self-owned tables for a waiter", () => {
  assert.equal(canWaiterUseTable("waiter-1", []), true);
  assert.equal(canWaiterUseTable("waiter-1", [{ waiterId: null }]), true);
  assert.equal(canWaiterUseTable("waiter-1", [{ waiterId: "waiter-1" }]), true);
  assert.equal(canWaiterUseTable("waiter-1", [{ waiterId: "waiter-2" }]), false);
});

test("attributes a waiter's table order to that waiter", () => {
  assert.deepEqual(
    resolveTableOrderAttribution({ id: "waiter-1", role: "WAITER" }, null),
    { cashierId: "waiter-1", waiterId: "waiter-1" },
  );
});

test("blocks a waiter from appending to another waiter's table", () => {
  assert.throws(
    () =>
      resolveTableOrderAttribution(
        { id: "waiter-2", role: "WAITER" },
        { waiterId: "waiter-1" },
      ),
    TableOrderOwnershipError,
  );
});

test("cashier-created rounds retain the serving waiter", () => {
  assert.deepEqual(
    resolveTableOrderAttribution(
      { id: "cashier-1", role: "CASHIER" },
      { waiterId: "waiter-1" },
    ),
    { cashierId: "cashier-1", waiterId: "waiter-1" },
  );
});
