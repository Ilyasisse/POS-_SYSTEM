import assert from "node:assert/strict";
import test from "node:test";
import { filterKitchenTicketsByStatus } from "../../src/lib/kitchen/kitchen-status-filter";

const tickets = [
  {
    status: "in_progress" as const,
    stationStatuses: { BARISTA: "new" as const },
  },
  {
    status: "in_progress" as const,
    stationStatuses: { BARISTA: "in_progress" as const },
  },
  { status: "new" as const, stationStatuses: { BARISTA: "new" as const } },
];

test("kitchen filters by current station status while keeping queue order", () => {
  assert.deepEqual(
    filterKitchenTicketsByStatus(tickets, "all", "BARISTA"),
    tickets,
  );
  assert.deepEqual(filterKitchenTicketsByStatus(tickets, "new", "BARISTA"), [
    tickets[0],
    tickets[2],
  ]);
  assert.deepEqual(
    filterKitchenTicketsByStatus(tickets, "in_progress", "BARISTA"),
    [tickets[1]],
  );
  assert.deepEqual(filterKitchenTicketsByStatus(tickets, "new"), [tickets[2]]);
});
