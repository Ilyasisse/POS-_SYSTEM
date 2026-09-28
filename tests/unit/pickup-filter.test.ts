import assert from "node:assert/strict";
import test from "node:test";
import { filterPickupTickets } from "../../src/lib/waiter/pickup-filter";

const tickets = [
  {
    tableName: "Patio 4",
    orderNumber: 101,
    pickupStatus: "ready",
    claimedByWaiterId: null,
  },
  {
    tableName: "Main 2",
    orderNumber: 102,
    pickupStatus: "claimed",
    claimedByWaiterId: "me",
  },
  {
    tableName: "Patio 5",
    orderNumber: 103,
    pickupStatus: "claimed",
    claimedByWaiterId: "other",
  },
];

test("pickup search finds table names and exact order numbers", () => {
  assert.deepEqual(filterPickupTickets(tickets, " patio ", "all", "me"), [
    tickets[0],
    tickets[2],
  ]);
  assert.deepEqual(filterPickupTickets(tickets, "#102", "all", "me"), [
    tickets[1],
  ]);
  assert.deepEqual(filterPickupTickets(tickets, "10", "all", "me"), []);
});

test("pickup views preserve original order and isolate own claims", () => {
  assert.deepEqual(filterPickupTickets(tickets, "", "unclaimed", "me"), [
    tickets[0],
  ]);
  assert.deepEqual(filterPickupTickets(tickets, "", "mine", "me"), [
    tickets[1],
  ]);
  assert.deepEqual(filterPickupTickets(tickets, "patio", "mine", "me"), []);
  assert.deepEqual(filterPickupTickets(tickets, "", "all", "me"), tickets);
});
