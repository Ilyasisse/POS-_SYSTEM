import assert from "node:assert/strict";
import { after, test } from "node:test";
import { client, db, json, product, table, user, type OrderResponse } from "../workflow/fixtures";

after(() => db.$disconnect());

test("station updates and competing pickup claims persist one valid handoff", async () => {
  const [coffee, food, diningTable, cashier, barista, cook, waiterOne, waiterTwo] =
    await Promise.all([
      product("BARISTA"),
      product("FAST_FOOD"),
      table(),
      user("CASHIER"),
      user("BARISTA", { station: "BARISTA" }),
      user("COOK", { station: "FAST_FOOD" }),
      user("WAITER"),
      user("WAITER"),
    ]);
  const [sales, drinks, kitchen, first, second] = await Promise.all([
    client(cashier),
    client(barista),
    client(cook),
    client(waiterOne),
    client(waiterTwo),
  ]);
  const { order } = await json<OrderResponse>(
    await sales("/api/orders/table", {
      body: {
        tableId: diningTable.id,
        items: [
          { productId: coffee.id, qty: 1, assignedBaristaId: barista.id },
          { productId: food.id, qty: 1 },
        ],
      },
    }),
  );
  const path = `/api/kitchen/tickets/${order.id}`;
  const change = (station: string, status: string) => ({
    method: "PATCH",
    body: { station, status },
  });
  const tickets = await json<{ tickets: Array<{ id: string; items: Array<{ name: string }> }> }>(
    await drinks("/api/kitchen/tickets"),
  );
  assert.deepEqual(
    tickets.tickets.find((ticket) => ticket.id === order.id)?.items.map(({ name }) => name),
    [coffee.name],
  );
  assert.equal((await drinks(`${path}/station`, change("FAST_FOOD", "done"))).status, 403);

  await json(await drinks(`${path}/station`, change("BARISTA", "in_progress")));
  await json(await drinks(`${path}/station`, change("BARISTA", "done")));
  await json(await drinks(`${path}/station`, change("BARISTA", "done")));
  assert.equal(
    await db.kitchenTransitionEvent.count({
      where: { orderId: order.id, type: "STATION_COMPLETED" },
    }),
    1,
  );
  assert.notEqual(
    (await db.kitchenTicketState.findUniqueOrThrow({ where: { orderId: order.id } })).pickupStatus,
    "READY",
  );

  await json(await kitchen(`${path}/station`, change("FAST_FOOD", "in_progress")));
  await json(await kitchen(`${path}/station`, change("FAST_FOOD", "done")));
  assert.equal(
    (await db.kitchenTicketState.findUniqueOrThrow({ where: { orderId: order.id } })).pickupStatus,
    "READY",
  );

  const pickup = (pickupStatus: string) => ({ method: "PATCH", body: { pickupStatus } });
  const claims = await Promise.all(
    [first, second].map((api) => api(`${path}/pickup`, pickup("claimed"))),
  );
  assert.deepEqual(claims.map(({ status }) => status).sort(), [200, 409]);
  const ticket = await db.kitchenTicketState.findUniqueOrThrow({ where: { orderId: order.id } });
  assert.ok(ticket.claimedByWaiterId === waiterOne.id || ticket.claimedByWaiterId === waiterTwo.id);
  assert.equal(
    await db.kitchenTransitionEvent.count({ where: { orderId: order.id, type: "PICKUP_CLAIMED" } }),
    1,
  );
  const [winner, other] =
    ticket.claimedByWaiterId === waiterOne.id ? [first, second] : [second, first];
  assert.equal((await other(`${path}/pickup`, pickup("delivered"))).ok, false);
  await json(await winner(`${path}/pickup`, pickup("delivered")));
  assert.equal(
    (await db.kitchenTicketState.findUniqueOrThrow({ where: { orderId: order.id } })).pickupStatus,
    "DELIVERED",
  );
});
