import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import {
  client,
  db,
  json,
  phone,
  product,
  sendReceipt,
  table,
  unique,
  user,
  type OrderResponse,
} from "../workflow/fixtures";
import { transferOpenTableService } from "../../src/lib/cashier/table-transfer";
import type { TableCheck } from "@prisma/client";

after(() => db.$disconnect());

test("table rounds use server prices and split receipts settle the check once", async () => {
  const [cashier, diningTable, item] = await Promise.all([user("CASHIER"), table(), product()]);
  const api = await client(cashier);
  const group = await db.modifierGroup.create({
    data: { name: unique("Size"), isRequired: true, minSelect: 1, maxSelect: 1 },
  });
  const modifier = await db.modifier.create({
    data: { name: "Large", modifierGroupId: group.id, productId: item.id, price: 2 },
  });
  const path = "/api/orders/table";
  const orderInput = {
    tableId: diningTable.id,
    items: [
      {
        productId: item.id,
        qty: 1,
        unitPrice: 0.01,
        modifiers: [{ modifierId: modifier.id, qty: 1, price: 0.01 }],
      },
    ],
  };
  const first = await json<OrderResponse>(await api(path, { body: orderInput }));
  const second = await json<OrderResponse>(await api(path, { body: orderInput }));
  const rounds = await db.order.findMany({
    where: { tableId: diningTable.id },
    orderBy: { tableCheckRound: "asc" },
  });
  assert.deepEqual(
    rounds.map(({ id }) => id),
    [first.order.id, second.order.id],
  );
  assert.deepEqual(
    rounds.map(({ tableCheckRound, total }) => [tableCheckRound, Number(total)]),
    [
      [1, 7],
      [2, 7],
    ],
  );
  const checkId = rounds[0].tableCheckId;
  assert.ok(checkId);
  assert.equal(rounds[1].tableCheckId, checkId);
  assert.equal(
    await db.kitchenTicketState.count({ where: { orderId: { in: rounds.map(({ id }) => id) } } }),
    2,
  );
  assert.equal(await db.stockEvent.count({ where: { productId: item.id } }), 2);
  assert.equal(
    Number((await db.product.findUniqueOrThrow({ where: { id: item.id } })).stockQty),
    18,
  );

  const batchKey = randomUUID();
  const lines = [1, 2].map((number) => ({
    payerName: `Test Payer ${number}`,
    payerPhone: phone(),
    amount: 7,
    method: "GOLIS",
  }));
  const batch = { batchKey, tableId: diningTable.id, lines };
  const startPayment = () => api("/api/cashier/payment-requests", { body: batch });
  const requests = await json<{ requests: { id: string }[] }>(await startPayment());
  assert.deepEqual(await json(await startPayment()), requests);

  const target = await table();
  const occupied = await table();
  await json(await api(path, { body: { ...orderInput, tableId: occupied.id } }));
  await assert.rejects(
    transferOpenTableService({ sourceTableId: diningTable.id, targetTableId: occupied.id }),
  );
  await transferOpenTableService({ sourceTableId: diningTable.id, targetTableId: target.id });
  assert.equal(await db.paymentRequest.count({ where: { batchKey, tableId: target.id } }), 2);

  for (const [index, line] of lines.entries()) {
    const { receiptId } = await json<{ receiptId: string }>(
      await sendReceipt({
        phone: line.payerPhone,
        name: line.payerName,
        amount: line.amount,
      }),
      201,
    );
    const assign = () =>
      api(`/api/cashier/payment-receipts/${receiptId}/assign`, {
        body: { paymentRequestId: requests.requests[index].id },
      });
    await json(await assign());
    assert.equal((await assign()).ok, false);
    const check: TableCheck = await db.tableCheck.findUniqueOrThrow({ where: { id: checkId } });
    assert.equal(Boolean(check.closedAt), index === 1);
  }
  const payments = await db.payment.findMany({
    where: { orderId: { in: rounds.map(({ id }) => id) } },
  });
  assert.deepEqual(
    payments.map(({ amountPaid }) => Number(amountPaid)),
    [7, 7],
  );
  assert.equal(await db.order.count({ where: { tableId: target.id, status: "PAID" } }), 2);
});

test("invalid catalog selections and inactive tables leave no order, stock event or payment", async () => {
  const [cashier, diningTable, item, unavailable] = await Promise.all([
    user("CASHIER"),
    table(),
    product(),
    product(),
  ]);
  const api = await client(cashier);
  const group = await db.modifierGroup.create({
    data: { name: unique("Required size"), isRequired: true, minSelect: 1, maxSelect: 1 },
  });
  await db.modifier.create({
    data: { productId: item.id, modifierGroupId: group.id, name: "Large", price: 2 },
  });
  await db.product.update({ where: { id: unavailable.id }, data: { availableForSale: false } });
  const add = (productId: string) =>
    api("/api/orders/table", { body: { tableId: diningTable.id, items: [{ productId, qty: 1 }] } });
  assert.equal((await add(item.id)).status, 400);
  assert.equal((await add(unavailable.id)).status, 409);
  await db.table.update({ where: { id: diningTable.id }, data: { isActive: false } });
  assert.equal((await add(item.id)).status, 400);
  assert.equal(await db.order.count({ where: { tableId: diningTable.id } }), 0);
  assert.equal(
    await db.stockEvent.count({ where: { productId: { in: [item.id, unavailable.id] } } }),
    0,
  );
  assert.equal(await db.payment.count({ where: { cashierId: cashier.id } }), 0);
});
