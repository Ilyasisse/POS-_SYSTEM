import { expect, test } from "@jest/globals";

import {
  buildKitchenPrintHref,
  filterPrintableKitchenTicket,
  kitchenStationLabel,
} from "../../src/lib/kitchen/kitchen-print";
import type { KitchenTicket } from "../../src/lib/kitchen/kitchen-socket";

test("builds full and station-specific kitchen ticket links", () => {
  expect(buildKitchenPrintHref("order 1")).toBe("/print/kitchen/order%201");
  expect(buildKitchenPrintHref("order-1", "FAST_FOOD")).toBe(
    "/print/kitchen/order-1?station=FAST_FOOD",
  );
});

test("formats kitchen station labels for printed tickets", () => {
  expect(kitchenStationLabel("CUNTO_SOOMAALI")).toBe("Cunto Soomaali");
  expect(kitchenStationLabel("CABITAAN")).toBe("Cabitaan");
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
  expect(historicalTicket?.items.length).toBe(3);
  expect(historicalTicket?.status).toBe("done");
  expect(historicalTicket?.pickupStatus).toBe("delivered");
  const activeTicket: KitchenTicket = {
    ...completedTicket,
    stationStatuses: { FAST_FOOD: "new", BARISTA: "new" },
    pickupStatus: "preparing",
  };
  const printedActiveTicket = filterPrintableKitchenTicket(activeTicket, {
    role: "ADMIN",
  });
  expect(printedActiveTicket?.items.length).toBe(3);
  expect(printedActiveTicket?.status).toBe("new");
  expect(
    filterPrintableKitchenTicket(completedTicket, {
      role: "ADMIN",
      station: "FAST_FOOD",
    })?.items.map((item) => item.id),
  ).toStrictEqual(["food"]);
});

test("historical printing retains station and barista ownership restrictions", () => {
  const cookTicket = filterPrintableKitchenTicket(completedTicket, {
    role: "COOK",
    station: "FAST_FOOD",
  });
  expect(cookTicket?.items.map((item) => item.id)).toStrictEqual(["food"]);
  expect(cookTicket?.status).toBe("done");
  const baristaTicket = filterPrintableKitchenTicket(completedTicket, {
    role: "BARISTA",
    station: "BARISTA",
    userId: "barista-1",
  });
  expect(baristaTicket?.items.map((item) => item.id)).toStrictEqual(["coffee"]);
  expect(filterPrintableKitchenTicket(completedTicket, { role: "COOK" })).toBe(null);
  expect(
    filterPrintableKitchenTicket(completedTicket, {
      role: "BARISTA",
      station: "BARISTA",
    }),
  ).toBe(null);
  expect(
    filterPrintableKitchenTicket(completedTicket, {
      role: "COOK",
      station: "CABITAAN",
    }),
  ).toBe(null);
});
