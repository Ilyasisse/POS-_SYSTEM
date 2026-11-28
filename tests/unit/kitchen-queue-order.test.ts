import assert from "node:assert/strict";
import test from "node:test";
import { normalizeKitchenTicket } from "../../src/lib/kitchen/kitchen-socket";
import {
  earliestKitchenQueueEntry,
  sortKitchenQueueOldestFirst,
} from "../../src/lib/kitchen/kitchen-queue-order";

test("queue entry comes from station creation, not ticket edits or order time", () => {
  const events = [
    { type: "STATION_STARTED", occurredAt: new Date("2026-09-25T09:10:00Z") },
    { type: "STATION_CREATED", occurredAt: new Date("2026-09-25T09:00:00Z") },
    { type: "STATION_CREATED", occurredAt: new Date("2026-09-25T09:01:00Z") },
    { type: "STATION_REOPENED", occurredAt: new Date("2026-09-25T10:00:00Z") },
  ];
  assert.equal(
    earliestKitchenQueueEntry(events)?.toISOString(),
    "2026-09-25T09:00:00.000Z",
  );
  assert.equal(earliestKitchenQueueEntry([]), null);
});

test("held course fired later follows tickets already in kitchen", () => {
  const tickets = [
    {
      id: "held",
      createdAt: "2026-09-25T08:00:00Z",
      queueEnteredAt: "2026-09-25T10:00:00Z",
    },
    {
      id: "ordinary",
      createdAt: "2026-09-25T09:00:00Z",
      queueEnteredAt: "2026-09-25T09:00:00Z",
    },
    { id: "legacy", createdAt: "2026-09-25T09:30:00Z", queueEnteredAt: null },
  ];
  assert.deepEqual(
    sortKitchenQueueOldestFirst(tickets).map((item) => item.id),
    ["ordinary", "legacy", "held"],
  );
  assert.equal(tickets[0]?.id, "held", "sorting leaves API state unchanged");
});

test("queue entry survives normalization", () => {
  const ticket = normalizeKitchenTicket({
    id: "one",
    orderNumber: 1,
    createdAt: "2026-09-25T08:00:00Z",
    queueEnteredAt: "2026-09-25T10:00:00Z",
    items: [
      {
        id: "item",
        name: "Coffee",
        quantity: 1,
        station: "BARISTA",
        modifiers: [],
      },
    ],
  });
  assert.equal(ticket?.queueEnteredAt, "2026-09-25T10:00:00.000Z");
});
