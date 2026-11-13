import assert from "node:assert/strict";
import { after, test } from "node:test";
import {
  checkoutInput,
  client,
  db,
  json,
  phone,
  product,
  sendReceipt,
  table,
  user,
} from "../workflow/fixtures";

after(() => db.$disconnect());

type Checkout = { checkout: { id: string; amount: number; status: string } };
const path = "/api/customer/checkouts";

test("checkout and webhook replays persist one paid order, payment and kitchen ticket", async () => {
  const [item, diningTable, customer, stranger, manager] = await Promise.all([
    product(),
    table(),
    user("CUSTOMER", { name: "Test Customer" }),
    user("CUSTOMER"),
    user("MANAGER"),
  ]);
  const [api, other, staff] = await Promise.all([
    client(customer),
    client(stranger),
    client(manager),
  ]);
  const input = checkoutInput(item.id, phone(), diningTable.id);
  const { checkout } = await json<Checkout>(await api(path, { body: input }), 201);
  const replay = await json<Checkout>(await api(path, { body: input }), 200);
  assert.equal(replay.checkout.id, checkout.id);
  assert.equal(checkout.status, "PENDING");
  assert.equal((await other(`${path}/${checkout.id}`)).status, 404);
  assert.equal(await db.order.count({ where: { customerId: customer.id } }), 0);

  const message = {
    phone: input.paymentPhone,
    amount: checkout.amount,
    reference: String(Date.now()).slice(-10),
    at: new Date(),
  };
  const first = await json<{ receiptId: string }>(await sendReceipt(message), 201);
  const duplicate = await json<{ receiptId: string; duplicate: boolean }>(
    await sendReceipt(message),
    200,
  );
  assert.equal(duplicate.receiptId, first.receiptId);
  assert.equal(duplicate.duplicate, true);
  const paid = await db.customerCheckout.findUniqueOrThrow({ where: { id: checkout.id } });
  assert.equal(paid.status, "PAID");
  assert.equal(paid.receiptId, first.receiptId);
  assert.ok(paid.orderId);
  const order = await db.order.findUniqueOrThrow({
    where: { id: paid.orderId },
    include: { payments: true, kitchenTicketState: true },
  });
  assert.equal(order.tableId, diningTable.id);
  assert.equal(order.waiterId, null);
  assert.equal(order.cashierId, null);
  assert.equal(order.payments.length, 1);
  assert.equal(Number(order.payments[0].amountPaid), checkout.amount);
  assert.ok(order.kitchenTicketState);
  assert.equal(await db.order.count({ where: { customerId: customer.id } }), 1);
  assert.equal(await db.stockEvent.count({ where: { productId: item.id } }), 1);
  const board = await json<{ orders: Array<{ id: string }> }>(
    await staff("/api/staff/customer-fulfillment"),
  );
  assert.ok(board.orders.some(({ id }) => id === order.id));
});

test("ambiguous receipts require review and only one competing assignment can win", async () => {
  const [item, one, two, manager] = await Promise.all([
    product(),
    user("CUSTOMER"),
    user("CUSTOMER"),
    user("MANAGER"),
  ]);
  const [first, second, staff] = await Promise.all([client(one), client(two), client(manager)]);
  const payer = phone();
  const [a, b] = await Promise.all(
    [first, second].map(
      async (api) =>
        (await json<Checkout>(await api(path, { body: checkoutInput(item.id, payer) }), 201))
          .checkout,
    ),
  );
  const { receiptId } = await json<{ receiptId: string }>(
    await sendReceipt({ phone: payer, amount: a.amount }),
    201,
  );
  const candidates = { id: { in: [a.id, b.id] } };
  assert.equal(
    await db.customerCheckout.count({ where: { ...candidates, status: "REVIEW", orderId: null } }),
    2,
  );
  const assign = (id: string, reason: string) =>
    staff(`/api/cashier/customer-checkouts/${id}/assign`, { body: { receiptId, reason } });
  assert.equal((await assign(a.id, "")).status, 409);
  const results = await Promise.all(
    [a, b].map(({ id }) => assign(id, "Verified synthetic receipt")),
  );
  assert.deepEqual(results.map(({ status }) => status).sort(), [200, 409]);
  assert.equal(
    await db.customerCheckout.count({ where: { ...candidates, receiptId, status: "PAID" } }),
    1,
  );
  assert.equal(await db.order.count({ where: { customerId: { in: [one.id, two.id] } } }), 1);
});

for (const kind of ["wrong amount", "expired", "outgoing"] as const) {
  test(`${kind} leaves the checkout without a paid order`, async () => {
    const [item, customer, manager] = await Promise.all([
      product(),
      user("CUSTOMER"),
      user("MANAGER"),
    ]);
    const [api, staff] = await Promise.all([client(customer), client(manager)]);
    const input = checkoutInput(item.id);
    const { checkout } = await json<Checkout>(await api(path, { body: input }), 201);
    if (kind === "expired") {
      await db.customerCheckout.update({
        where: { id: checkout.id },
        data: {
          createdAt: new Date(Date.now() - 20 * 60_000),
          expiresAt: new Date(Date.now() - 5 * 60_000),
        },
      });
    }
    const { receiptId } = await json<{ receiptId: string }>(
      await sendReceipt({
        phone: input.paymentPhone,
        amount: checkout.amount + (kind === "wrong amount" ? 1 : 0),
        outgoing: kind === "outgoing",
      }),
      201,
    );
    if (kind === "wrong amount") {
      const assignment = await staff(`/api/cashier/customer-checkouts/${checkout.id}/assign`, {
        body: { receiptId, reason: "Checked synthetic receipt" },
      });
      assert.equal(assignment.status, 409);
    }
    const persisted = await db.customerCheckout.findUniqueOrThrow({ where: { id: checkout.id } });
    assert.equal(persisted.orderId, null);
    assert.equal(persisted.receiptId, null);
    assert.notEqual(persisted.status, "PAID");
  });
}
