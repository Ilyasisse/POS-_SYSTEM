import assert from "node:assert/strict";
import test from "node:test";
import { searchKitchenTickets } from "../../src/lib/kitchen/kitchen-ticket-search";

const tickets = [
  { orderNumber: 24, tableName: "Patio 2", items: [{ name: "Iced Coffee" }] },
  { orderNumber: 102, tableName: null, items: [{ name: "Somali Tea" }] },
  { orderNumber: 25, tableName: "Main 1", items: [{ name: "Iced Coffee" }] },
];

test("find active tickets by order number, table and item without changing queue order", () => {
  assert.deepEqual(searchKitchenTickets(tickets, "102"), [tickets[1]]);
  assert.deepEqual(searchKitchenTickets(tickets, " patio "), [tickets[0]]);
  assert.deepEqual(searchKitchenTickets(tickets, "ICEd COFfee"), [
    tickets[0],
    tickets[2],
  ]);
  assert.deepEqual(searchKitchenTickets(tickets, "  "), tickets);
  assert.deepEqual(searchKitchenTickets(tickets, "missing"), []);
});
