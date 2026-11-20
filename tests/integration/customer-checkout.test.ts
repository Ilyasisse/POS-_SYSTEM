import { expect, afterAll, test } from "@jest/globals";

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

afterAll(() => db.$disconnect());

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
  expect(replay.checkout.id).toBe(checkout.id);
  expect(checkout.status).toBe("PENDING");
  expect((await other(`${path}/${checkout.id}`)).status).toBe(404);
  expect(await db.order.count({ where: { customerId: customer.id } })).toBe(0);

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
  expect(duplicate.receiptId).toBe(first.receiptId);
  expect(duplicate.duplicate).toBe(true);
  const paid = await db.customerCheckout.findUniqueOrThrow({ where: { id: checkout.id } });
  expect(paid.status).toBe("PAID");
  expect(paid.receiptId).toBe(first.receiptId);
  expect(paid.orderId).toBeTruthy();
  if (!paid.orderId) throw new Error("Expected paid.orderId to be present");
  const order = await db.order.findUniqueOrThrow({
    where: { id: paid.orderId },
    include: { payments: true, kitchenTicketState: true },
  });
  expect(order.tableId).toBe(diningTable.id);
  expect(order.waiterId).toBe(null);
  expect(order.cashierId).toBe(null);
  expect(order.payments.length).toBe(1);
  expect(Number(order.payments[0].amountPaid)).toBe(checkout.amount);
  expect(order.kitchenTicketState).toBeTruthy();
  expect(await db.order.count({ where: { customerId: customer.id } })).toBe(1);
  expect(await db.stockEvent.count({ where: { productId: item.id } })).toBe(1);
  const board = await json<{ orders: Array<{ id: string }> }>(
    await staff("/api/staff/customer-fulfillment"),
  );
  expect(board.orders.some(({ id }) => id === order.id)).toBeTruthy();
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
  expect(
    await db.customerCheckout.count({ where: { ...candidates, status: "REVIEW", orderId: null } }),
  ).toBe(2);
  const assign = (id: string, reason: string) =>
    staff(`/api/cashier/customer-checkouts/${id}/assign`, { body: { receiptId, reason } });
  expect((await assign(a.id, "")).status).toBe(409);
  const results = await Promise.all(
    [a, b].map(({ id }) => assign(id, "Verified synthetic receipt")),
  );
  expect(results.map(({ status }) => status).sort()).toStrictEqual([200, 409]);
  expect(
    await db.customerCheckout.count({ where: { ...candidates, receiptId, status: "PAID" } }),
  ).toBe(1);
  expect(await db.order.count({ where: { customerId: { in: [one.id, two.id] } } })).toBe(1);
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
      expect(assignment.status).toBe(409);
    }
    const persisted = await db.customerCheckout.findUniqueOrThrow({ where: { id: checkout.id } });
    expect(persisted.orderId).toBe(null);
    expect(persisted.receiptId).toBe(null);
    expect(persisted.status).not.toBe("PAID");
  });
}
