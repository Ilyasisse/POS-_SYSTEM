import assert from "node:assert/strict";
import test from "node:test";
import {
  filterKitchenTicketByStation,
  normalizeKitchenTicket,
  setKitchenTicketStationStatus,
  type KitchenTicket,
} from "../../src/lib/kitchen/kitchen-socket";

function ticket(overrides: Partial<KitchenTicket> = {}): KitchenTicket {
  return {
    id: "order-1",
    orderId: "order-1",
    orderNumber: 1,
    ticketNumber: 1,
    roundNumber: 1,
    createdAt: "2026-10-02T10:00:00Z",
    status: "done",
    stationStatuses: {},
    stationMetrics: {},
    pickupStatus: "ready",
    items: [
      {
        id: "water",
        name: "Bottled water",
        quantity: 1,
        station: null,
        modifiers: [],
      },
    ],
    ...overrides,
  };
}

test("customer orders that need no kitchen preparation remain visible for pickup", () => {
  const ready = ticket();
  assert.equal(normalizeKitchenTicket(ready)?.status, "done");
  const pickup = filterKitchenTicketByStation(ready, { role: "WAITER" });
  assert.equal(pickup?.id, ready.id);
  assert.equal(pickup?.items[0]?.name, "Bottled water");
  assert.equal(filterKitchenTicketByStation(ready, "FAST_FOOD"), null);
  assert.equal(
    filterKitchenTicketByStation(
      { ...ready, pickupStatus: "delivered" },
      { role: "WAITER" },
    ),
    null,
  );
});

test("pickup includes stationless items alongside prepared items", () => {
  const mixed = ticket({
    stationStatuses: { FAST_FOOD: "done" },
    items: [
      ...ticket().items,
      {
        id: "burger",
        name: "Burger",
        quantity: 1,
        station: "FAST_FOOD",
        modifiers: [],
      },
    ],
  });
  const pickup = filterKitchenTicketByStation(mixed, { role: "WAITER" });
  assert.deepEqual(
    pickup?.items.map((item) => item.id),
    ["water", "burger"],
  );
});

test("reopening a ready or claimed station resets pickup and removes the previous claim", () => {
  for (const pickupStatus of ["ready", "claimed"] as const) {
    const reopened = setKitchenTicketStationStatus(
      ticket({
        stationStatuses: { FAST_FOOD: "done" },
        pickupStatus,
        claimedByWaiterId: "waiter-1",
        claimedByWaiterName: "Waiter",
        items: [
          {
            id: "burger",
            name: "Burger",
            quantity: 1,
            station: "FAST_FOOD",
            modifiers: [],
          },
        ],
      }),
      "FAST_FOOD",
      "new",
    );
    assert.equal(reopened.pickupStatus, "preparing");
    assert.equal(reopened.claimedByWaiterId, null);
    assert.equal(reopened.claimedByWaiterName, null);
    assert.equal(
      filterKitchenTicketByStation(reopened, { role: "WAITER" }),
      null,
    );
    const completed = setKitchenTicketStationStatus(
      reopened,
      "FAST_FOOD",
      "done",
    );
    assert.equal(completed.pickupStatus, "ready");
  }
});
