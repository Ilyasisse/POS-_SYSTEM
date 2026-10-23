import assert from "node:assert/strict";
import test from "node:test";
import { findWaiterOrders } from "../../src/lib/manager/waiter-order-lookup";

const orders = [
  { orderNumber: 201, table: { name: "Patio 2" } },
  { orderNumber: 202, table: { name: "Main 1" } },
  { orderNumber: 203, table: null },
];

test("manager finds waiter orders by table or exact order number", () => {
  assert.deepEqual(findWaiterOrders(orders, " patio "), [orders[0]]);
  assert.deepEqual(findWaiterOrders(orders, "#203"), [orders[2]]);
  assert.deepEqual(findWaiterOrders(orders, "20"), []);
  assert.deepEqual(findWaiterOrders(orders, ""), orders);
});
