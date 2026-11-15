import { expect, afterAll, test } from "@jest/globals";
import { randomUUID } from "node:crypto";

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

afterAll(() => db.$disconnect());

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
  expect(rounds.map(({ id }) => id)).toStrictEqual([first.order.id, second.order.id]);
  expect(
    rounds.map(({ tableCheckRound, total }) => [tableCheckRound, Number(total)]),
  ).toStrictEqual([
    [1, 7],
    [2, 7],
  ]);
  const checkId = rounds[0].tableCheckId;
  expect(checkId).toBeTruthy();
  if (!checkId) throw new Error("Expected checkId to be present");
  expect(rounds[1].tableCheckId).toBe(checkId);
  expect(
    await db.kitchenTicketState.count({ where: { orderId: { in: rounds.map(({ id }) => id) } } }),
  ).toBe(2);
  expect(await db.stockEvent.count({ where: { productId: item.id } })).toBe(2);
  expect(Number((await db.product.findUniqueOrThrow({ where: { id: item.id } })).stockQty)).toBe(
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
  expect(await json(await startPayment())).toStrictEqual(requests);

  const target = await table();
  const occupied = await table();
  await json(await api(path, { body: { ...orderInput, tableId: occupied.id } }));
  await expect(
    transferOpenTableService({ sourceTableId: diningTable.id, targetTableId: occupied.id }),
  ).rejects.toThrow();
  await transferOpenTableService({ sourceTableId: diningTable.id, targetTableId: target.id });
  expect(await db.paymentRequest.count({ where: { batchKey, tableId: target.id } })).toBe(2);

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
    expect((await assign()).ok).toBe(false);
    const check: TableCheck = await db.tableCheck.findUniqueOrThrow({ where: { id: checkId } });
    expect(Boolean(check.closedAt)).toBe(index === 1);
  }
  const payments = await db.payment.findMany({
    where: { orderId: { in: rounds.map(({ id }) => id) } },
  });
  expect(payments.map(({ amountPaid }) => Number(amountPaid))).toStrictEqual([7, 7]);
  expect(await db.order.count({ where: { tableId: target.id, status: "PAID" } })).toBe(2);
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
  expect((await add(item.id)).status).toBe(400);
  expect((await add(unavailable.id)).status).toBe(409);
  await db.table.update({ where: { id: diningTable.id }, data: { isActive: false } });
  expect((await add(item.id)).status).toBe(400);
  expect(await db.order.count({ where: { tableId: diningTable.id } })).toBe(0);
  expect(
    await db.stockEvent.count({ where: { productId: { in: [item.id, unavailable.id] } } }),
  ).toBe(0);
  expect(await db.payment.count({ where: { cashierId: cashier.id } })).toBe(0);
});
