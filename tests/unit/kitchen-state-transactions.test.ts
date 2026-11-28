import assert from "node:assert/strict";
import Module from "node:module";
import test from "node:test";

const moduleLoader = Module as unknown as {
  _load: (id: string, ...args: unknown[]) => unknown;
};
const originalLoad = moduleLoader._load;
const database: { $transaction?: unknown; kitchenTicketState?: unknown } = {};
moduleLoader._load = function (id, ...args) {
  if (id === "server-only") return {};
  if (id === "@/lib/prisma") return { prisma: database };
  return originalLoad.call(this, id, ...args);
};
const kitchen = import("../../src/lib/kitchen/kitchen-tickets").finally(() => {
  moduleLoader._load = originalLoad;
});

test("reopening claimed kitchen work revokes pickup and records its real previous status", async () => {
  const { updateKitchenTicketStation } = await kitchen;
  const events: Record<string, unknown>[] = [];
  let ticketUpdate: Record<string, unknown> | undefined;
  const tx = {
    $queryRaw: async () => [{ orderId: "order-1" }],
    kitchenTicketState: {
      findUniqueOrThrow: async () => ({
        pickupStatus: "CLAIMED",
        claimedByWaiterId: "waiter-1",
        stationStates: [{ station: "FAST_FOOD", status: "DONE" }],
      }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        ticketUpdate = data;
      },
    },
    kitchenPreparationTarget: { findUnique: async () => null },
    kitchenTicketStationState: { update: async () => undefined },
    kitchenTransitionEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        events.push(data);
      },
    },
  };
  database.$transaction = (callback: (value: unknown) => unknown) =>
    callback(tx);
  await updateKitchenTicketStation({
    orderId: "order-1",
    station: "FAST_FOOD",
    status: "new",
    actorUserId: "cook-1",
  });
  assert.deepEqual(ticketUpdate, {
    pickupStatus: "PREPARING",
    claimedByWaiterId: null,
    claimedByWaiterName: null,
  });
  assert.equal(events[1]?.type, "PICKUP_REOPENED");
  assert.equal(events[1]?.fromPickupStatus, "CLAIMED");
});

test("delivered kitchen tickets cannot be reopened", async () => {
  const { updateKitchenTicketStation, KitchenTicketMutationError } =
    await kitchen;
  database.$transaction = (callback: (value: unknown) => unknown) =>
    callback({
      $queryRaw: async () => [{ orderId: "order-1" }],
      kitchenTicketState: {
        findUniqueOrThrow: async () => ({
          pickupStatus: "DELIVERED",
          stationStates: [{ station: "FAST_FOOD", status: "DONE" }],
        }),
        update: async () => undefined,
      },
      kitchenPreparationTarget: { findUnique: async () => null },
      kitchenTicketStationState: { update: async () => undefined },
      kitchenTransitionEvent: { create: async () => undefined },
    });
  await assert.rejects(
    updateKitchenTicketStation({
      orderId: "order-1",
      station: "FAST_FOOD",
      status: "new",
      actorUserId: "cook-1",
    }),
    (error) =>
      error instanceof KitchenTicketMutationError && error.status === 409,
  );
});

test("the persisted no-preparation customer order reaches the waiter pickup snapshot", async () => {
  const { getKitchenTicketSnapshot } = await kitchen;
  database.kitchenTicketState = {
    findMany: async () => [
      {
        orderId: "order-1",
        pickupStatus: "READY",
        stationStates: [],
        transitions: [],
        customerName: "Customer",
        order: {
          orderNumber: 1,
          createdAt: new Date("2026-10-02T10:00:00Z"),
          orderItems: [
            {
              id: "item-1",
              productName: "Water",
              qty: 1,
              station: null,
              modifiers: [],
            },
          ],
        },
      },
    ],
  };
  const result = await getKitchenTicketSnapshot({
    id: "waiter-1",
    role: "WAITER",
    station: null,
  });
  assert.equal(result.length, 1);
  assert.equal(result[0]?.status, "done");
  assert.equal(result[0]?.items[0]?.name, "Water");
});
