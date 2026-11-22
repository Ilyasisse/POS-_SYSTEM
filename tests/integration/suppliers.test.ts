import { expect, afterAll, test } from "@jest/globals";

import {
  completePurchaseOrderAndCreateInvoiceDraft,
  finalizeSupplierInvoice,
} from "../../src/lib/suppliers/invoice-service";
import { recordSupplierPayment, revertSupplierPayment } from "../../src/lib/suppliers/bill-service";
import { prisma } from "../../src/lib/prisma";
import { processScheduledSupplierOrders } from "../../src/lib/supplier-orders/service";
import { client, db, json } from "../workflow/fixtures";
import { supplierCatalog, supplierRequest } from "../workflow/supplier-fixture";

afterAll(async () => {
  await Promise.all([db.$disconnect(), prisma.$disconnect()]);
});

test("purchase order completion, invoice stock receipt and payment reversal reconcile once", async () => {
  const { item, admin, supplier, catalog } = await supplierCatalog();
  const today = new Date().toISOString().slice(0, 10);
  const purchase = await db.supplierPurchaseOrder.create({
    data: {
      supplierId: supplier.id,
      expectedDeliveryDate: new Date(today),
      createdByUserId: admin.id,
      totalAmount: 12,
      items: {
        create: {
          supplierCatalogItemId: catalog.id,
          itemName: item.name,
          itemUnit: "piece",
          quantity: 3,
          unitPrice: 4,
          lineTotal: 12,
        },
      },
    },
  });
  const { invoiceId } = await completePurchaseOrderAndCreateInvoiceDraft(purchase.id, admin.id);
  expect((await completePurchaseOrderAndCreateInvoiceDraft(purchase.id, admin.id)).invoiceId).toBe(
    invoiceId,
  );
  expect(await db.supplierInvoice.count({ where: { purchaseOrderId: purchase.id } })).toBe(1);
  expect(await db.stockEvent.count({ where: { productId: item.id } })).toBe(0);

  const draft = {
    invoiceDate: today,
    dueDate: today,
    lines: [
      {
        kind: "catalog" as const,
        catalogItemId: catalog.id,
        itemName: item.name,
        itemUnit: "piece",
        quantity: "3",
        unitPrice: "4",
      },
    ],
  };
  await finalizeSupplierInvoice(invoiceId, admin.id, draft);
  await expect(finalizeSupplierInvoice(invoiceId, admin.id, draft)).rejects.toThrow();
  const bill = await db.supplierBill.findUniqueOrThrow({ where: { invoiceId } });
  expect(await db.stockEvent.count({ where: { productId: item.id, type: "RECEIPT" } })).toBe(1);
  expect(Number((await db.product.findUniqueOrThrow({ where: { id: item.id } })).stockQty)).toBe(
    23,
  );

  await recordSupplierPayment({
    supplierId: supplier.id,
    recordedByUserId: admin.id,
    amount: 5,
    preferredBillId: bill.id,
  });
  expect(
    Number((await db.supplierBill.findUniqueOrThrow({ where: { id: bill.id } })).paidAmount),
  ).toBe(5);
  const payment = await db.supplierPayment.findFirstOrThrow({ where: { supplierId: supplier.id } });
  await revertSupplierPayment(payment.id, { canManageDailyCash: true });
  expect(
    Number((await db.supplierBill.findUniqueOrThrow({ where: { id: bill.id } })).paidAmount),
  ).toBe(0);
});

test("closing a scheduled request freezes employee quantities and creates one purchase order", async () => {
  const { token, catalog, run, supplier, recipient } = await supplierRequest();
  const api = await client();
  const path = `/api/supplier-order-requests/${token}`;
  const response = { noOrder: false, items: [{ catalogItemId: catalog.id, quantity: "2.5" }] };
  await json(await api(path, { body: response }), 200);
  const deadline = new Date(Date.now() - 5000);
  await db.supplierOrderRun.update({ where: { id: run.id }, data: { supplierSendAt: deadline } });
  expect((await api(path, { body: { noOrder: true } })).status).toBe(400);
  expect(await db.supplierOrderResponseItem.count({ where: { recipientId: recipient.id } })).toBe(
    1,
  );

  // The scheduler needs its feature flag. The seeded delivery stands in for an
  // already acknowledged provider response, so the local run sends no message.
  await db.supplierOrderWhatsAppDelivery.create({
    data: {
      runId: run.id,
      dedupeKey: `${run.id}:supplier-order`,
      type: "SUPPLIER_ORDER",
      recipientPhone: run.supplierPhone,
      status: "ACCEPTED",
      provider: "TWILIO",
    },
  });
  const previous = process.env.TWILIO_WHATSAPP_ENABLED;
  process.env.TWILIO_WHATSAPP_ENABLED = "true";
  try {
    const first = await processScheduledSupplierOrders();
    const replay = await processScheduledSupplierOrders();
    expect(first.finalized.created).toBe(1);
    expect(replay.finalized.created).toBe(0);
  } finally {
    if (previous === undefined) delete process.env.TWILIO_WHATSAPP_ENABLED;
    else process.env.TWILIO_WHATSAPP_ENABLED = previous;
  }
  const orders = await db.supplierPurchaseOrder.findMany({
    where: { supplierId: supplier.id },
    include: { items: true },
  });
  expect(orders.length).toBe(1);
  expect(Number(orders[0].items[0].quantity)).toBe(2.5);
});
