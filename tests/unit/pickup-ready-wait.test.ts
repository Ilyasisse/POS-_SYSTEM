import assert from "node:assert/strict";
import test from "node:test";
import { normalizeKitchenTicket } from "../../src/lib/kitchen/kitchen-socket";
import {
  formatPickupWait,
  latestPickupReadyAt,
  sortWaiterPickupTickets,
} from "../../src/lib/kitchen/pickup-priority";

test("the latest ready transition wins after kitchen work reopens", () => {
  const events = [
    { type: "PICKUP_READY", occurredAt: new Date("2026-09-25T09:00:00Z") },
    { type: "PICKUP_REOPENED", occurredAt: new Date("2026-09-25T09:02:00Z") },
    { type: "PICKUP_READY", occurredAt: new Date("2026-09-25T09:04:00Z") },
  ];
  assert.equal(
    latestPickupReadyAt(events)?.toISOString(),
    "2026-09-25T09:04:00.000Z",
  );
  assert.equal(latestPickupReadyAt([]), null);
});

test("unclaimed food waits longest first; claimed and unknown timestamps follow", () => {
  const tickets = [
    {
      id: "claimed",
      pickupStatus: "claimed" as const,
      readyAt: "2026-09-25T08:00:00Z",
      createdAt: "2026-09-25T07:00:00Z",
    },
    {
      id: "newer",
      pickupStatus: "ready" as const,
      readyAt: "2026-09-25T09:05:00Z",
      createdAt: "2026-09-25T08:00:00Z",
    },
    {
      id: "unknown",
      pickupStatus: "ready" as const,
      readyAt: null,
      createdAt: "2026-09-25T06:00:00Z",
    },
    {
      id: "older",
      pickupStatus: "ready" as const,
      readyAt: "2026-09-25T09:00:00Z",
      createdAt: "2026-09-25T08:00:00Z",
    },
  ];
  assert.deepEqual(
    sortWaiterPickupTickets(tickets).map((item) => item.id),
    ["older", "newer", "unknown", "claimed"],
  );
  assert.equal(
    tickets[0]?.id,
    "claimed",
    "sorting does not mutate the original queue",
  );
});

test("ready age never guesses from order creation time", () => {
  const now = Date.parse("2026-09-25T09:07:00Z");
  assert.equal(formatPickupWait("2026-09-25T09:04:00Z", now), "Waiting 3 min");
  assert.equal(formatPickupWait(null, now), "Ready time unavailable");
  assert.equal(formatPickupWait("invalid", now), "Ready time unavailable");
  assert.equal(formatPickupWait("2026-09-25T09:08:00Z", now), "Ready just now");
});

test("ready transition timestamp survives ticket normalization", () => {
  const ticket = normalizeKitchenTicket({
    id: "one",
    orderNumber: 1,
    createdAt: "2026-09-25T08:00:00Z",
    readyAt: "2026-09-25T09:04:00Z",
    pickupStatus: "ready",
    items: [{ id: "line", name: "Coffee", quantity: 1, station: "BARISTA" }],
  });
  assert.equal(ticket?.readyAt, "2026-09-25T09:04:00.000Z");
  assert.notEqual(ticket?.readyAt, ticket?.createdAt);
});
