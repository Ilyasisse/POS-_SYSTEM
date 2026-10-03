import assert from "node:assert/strict";
import test from "node:test";
import {
  buildKitchenPrintHref,
  filterPrintableKitchenTicket,
  kitchenStationLabel,
} from "../../src/lib/kitchen/kitchen-print";
import type { KitchenTicket } from "../../src/lib/kitchen/kitchen-socket";

test("builds full and station-specific kitchen ticket links", () => {
  assert.equal(buildKitchenPrintHref("order 1"), "/print/kitchen/order%201");
  assert.equal(
    buildKitchenPrintHref("order-1", "FAST_FOOD"),
    "/print/kitchen/order-1?station=FAST_FOOD",
  );
});

test("formats kitchen station labels for printed tickets", () => {
  assert.equal(kitchenStationLabel("CUNTO_SOOMAALI"), "Cunto Soomaali");
  assert.equal(kitchenStationLabel("CABITAAN"), "Cabitaan");
});

const completedTicket: KitchenTicket = {
  id: "ticket-1",
  orderId: "order-1",
  orderNumber: 1,
  ticketNumber: 1,
  roundNumber: 1,
  createdAt: "2026-10-03T12:00:00.000Z",
  status: "done",
  stationStatuses: { FAST_FOOD: "done", BARISTA: "done" },
  stationMetrics: {},
  pickupStatus: "delivered",
  items: [
    {
      id: "food",
      name: "Burger",
      quantity: 1,
      station: "FAST_FOOD",
      modifiers: [],
    },
    {
      id: "coffee",
      name: "Coffee",
      quantity: 1,
      station: "BARISTA",
      assignedUserId: "barista-1",
      modifiers: [],
    },
    {
      id: "tea",
      name: "Tea",
      quantity: 1,
      station: "BARISTA",
      assignedUserId: "barista-2",
      modifiers: [],
    },
  ],
};

test("admin can print active and completed tickets across stations", () => {
  const historicalTicket = filterPrintableKitchenTicket(completedTicket, {
    role: "ADMIN",
  });
  assert.equal(historicalTicket?.items.length, 3);
  assert.equal(historicalTicket?.status, "done");
  assert.equal(historicalTicket?.pickupStatus, "delivered");
  const activeTicket: KitchenTicket = {
    ...completedTicket,
    stationStatuses: { FAST_FOOD: "new", BARISTA: "new" },
    pickupStatus: "preparing",
  };
  const printedActiveTicket = filterPrintableKitchenTicket(activeTicket, {
    role: "ADMIN",
  });
  assert.equal(printedActiveTicket?.items.length, 3);
  assert.equal(printedActiveTicket?.status, "new");
  assert.deepEqual(
    filterPrintableKitchenTicket(completedTicket, {
      role: "ADMIN",
      station: "FAST_FOOD",
    })?.items.map((item) => item.id),
    ["food"],
  );
});

test("historical printing retains station and barista ownership restrictions", () => {
  const cookTicket = filterPrintableKitchenTicket(completedTicket, {
    role: "COOK",
    station: "FAST_FOOD",
  });
  assert.deepEqual(
    cookTicket?.items.map((item) => item.id),
    ["food"],
  );
  assert.equal(cookTicket?.status, "done");
  const baristaTicket = filterPrintableKitchenTicket(completedTicket, {
    role: "BARISTA",
    station: "BARISTA",
    userId: "barista-1",
  });
  assert.deepEqual(
    baristaTicket?.items.map((item) => item.id),
    ["coffee"],
  );
  assert.equal(
    filterPrintableKitchenTicket(completedTicket, { role: "COOK" }),
    null,
  );
  assert.equal(
    filterPrintableKitchenTicket(completedTicket, {
      role: "BARISTA",
      station: "BARISTA",
    }),
    null,
  );
  assert.equal(
    filterPrintableKitchenTicket(completedTicket, {
      role: "COOK",
      station: "CABITAAN",
    }),
    null,
  );
});
