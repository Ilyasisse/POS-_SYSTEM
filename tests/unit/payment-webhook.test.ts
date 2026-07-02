import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  normalizeMycashGolisWebhookPayload,
  processMycashGolisWebhook,
  readPaymentWebhookConfig,
  verifyPaymentWebhookSignature,
  type PaymentWebhookCashier,
  type PaymentWebhookOrder,
  type PaymentWebhookStore,
} from "../../src/lib/payments/mycash-golis-webhook";

const cashier: PaymentWebhookCashier = {
  id: "cashier-1",
  fullName: "Webhook Cashier",
  isActive: true,
};

function openOrder(total = 15.5): PaymentWebhookOrder {
  return {
    id: "order-1",
    orderNumber: 123,
    status: "OPEN",
    total,
  };
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    provider: "MYCASH",
    status: "SUCCESS",
    orderNumber: 123,
    amount: 15.5,
    reference: "provider-reference-1",
    paidAt: "2026-06-25T10:00:00.000Z",
    ...overrides,
  };
}

function store(
  overrides: Partial<PaymentWebhookStore> = {},
): PaymentWebhookStore & {
  markedPaid: Array<{
    method: string;
    reference: string;
    paidAt: Date;
  }>;
} {
  const markedPaid: Array<{
    method: string;
    reference: string;
    paidAt: Date;
  }> = [];

  return {
    markedPaid,
    getCashier: async () => cashier,
    findPaymentByReference: async () => null,
    findOrder: async () => openOrder(),
    markOrderPaid: async (input) => {
      markedPaid.push({
        method: input.event.provider,
        reference: input.event.reference,
        paidAt: input.paidAt,
      });
    },
    ...overrides,
  };
}

function signBody(rawBody: string, secret: string) {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

test("reads required webhook config and validates webhook signatures", () => {
  assert.deepEqual(
    readPaymentWebhookConfig({
      PAYMENT_WEBHOOK_SECRET: " secret ",
      PAYMENT_WEBHOOK_CASHIER_ID: " cashier-1 ",
    }),
    {
      ok: true,
      secret: "secret",
      cashierId: "cashier-1",
    },
  );

  const rawBody = JSON.stringify(payload());
  const signature = signBody(rawBody, "secret");

  assert.equal(verifyPaymentWebhookSignature(rawBody, null, "secret"), false);
  assert.equal(
    verifyPaymentWebhookSignature(rawBody, "sha256=wrong", "secret"),
    false,
  );
  assert.equal(
    verifyPaymentWebhookSignature(rawBody, `sha256=${signature}`, "secret"),
    true,
  );
  assert.equal(
    verifyPaymentWebhookSignature(
      JSON.stringify(payload({ amount: 1 })),
      `sha256=${signature}`,
      "secret",
    ),
    false,
  );
  assert.equal(
    readPaymentWebhookConfig({ PAYMENT_WEBHOOK_CASHIER_ID: "cashier-1" }).ok,
    false,
  );
});

test("normalizes generic MYCASH/GOLIS payloads", () => {
  const result = normalizeMycashGolisWebhookPayload(
    payload({
      provider: "golis",
      status: "paid",
      orderNumber: "123",
      amount: "15.50",
    }),
  );

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.event.provider, "GOLIS");
    assert.equal(result.event.status, "PAID");
    assert.equal(result.event.orderNumber, 123);
    assert.equal(result.event.amount, 15.5);
    assert.equal(result.event.isSuccess, true);
  }
});

test("rejects invalid webhook payloads", () => {
  assert.equal(normalizeMycashGolisWebhookPayload(null).ok, false);
  assert.equal(
    normalizeMycashGolisWebhookPayload(payload({ provider: "CARD" })).ok,
    false,
  );
  assert.equal(
    normalizeMycashGolisWebhookPayload(payload({ reference: "" })).ok,
    false,
  );
  assert.equal(
    normalizeMycashGolisWebhookPayload(
      payload({ orderId: "", orderNumber: "" }),
    ).ok,
    false,
  );
  assert.equal(
    normalizeMycashGolisWebhookPayload(payload({ amount: 0 })).ok,
    false,
  );
  assert.equal(
    normalizeMycashGolisWebhookPayload(payload({ paidAt: "not-a-date" })).ok,
    false,
  );
});

test("successful webhook marks an open order paid", async () => {
  const fakeStore = store();
  const result = await processMycashGolisWebhook(payload(), {
    cashierId: "cashier-1",
    store: fakeStore,
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(fakeStore.markedPaid.length, 1);
  assert.deepEqual(fakeStore.markedPaid[0], {
    method: "MYCASH",
    reference: "provider-reference-1",
    paidAt: new Date("2026-06-25T10:00:00.000Z"),
  });
});

test("GOLIS webhook records the provider reference", async () => {
  const fakeStore = store();
  const result = await processMycashGolisWebhook(
    payload({
      provider: "GOLIS",
      reference: "golis-transaction-7",
    }),
    {
      cashierId: "cashier-1",
      store: fakeStore,
    },
  );

  assert.equal(result.status, 200);
  assert.equal(fakeStore.markedPaid[0]?.method, "GOLIS");
  assert.equal(fakeStore.markedPaid[0]?.reference, "golis-transaction-7");
});

test("duplicate provider reference returns success without another payment", async () => {
  const fakeStore = store({
    findPaymentByReference: async () => ({
      id: "payment-1",
      orderId: "order-1",
      reference: "provider-reference-1",
    }),
  });

  const result = await processMycashGolisWebhook(payload(), {
    cashierId: "cashier-1",
    store: fakeStore,
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.duplicate, true);
  assert.equal(fakeStore.markedPaid.length, 0);
});

test("amount mismatch rejects without changing the order", async () => {
  const fakeStore = store({
    findOrder: async () => openOrder(20),
  });

  const result = await processMycashGolisWebhook(payload(), {
    cashierId: "cashier-1",
    store: fakeStore,
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.error, "Payment amount does not match order total.");
  assert.equal(fakeStore.markedPaid.length, 0);
});

test("already-paid order with a new reference returns a conflict", async () => {
  const fakeStore = store({
    findOrder: async () => ({
      ...openOrder(),
      status: "PAID",
    }),
  });

  const result = await processMycashGolisWebhook(
    payload({ reference: "new-reference" }),
    {
      cashierId: "cashier-1",
      store: fakeStore,
    },
  );

  assert.equal(result.status, 409);
  assert.equal(result.body.error, "Order is not open for payment.");
  assert.equal(fakeStore.markedPaid.length, 0);
});

test("failed provider status is ignored", async () => {
  const fakeStore = store();
  const result = await processMycashGolisWebhook(
    payload({ status: "FAILED" }),
    {
      cashierId: "cashier-1",
      store: fakeStore,
    },
  );

  assert.equal(result.status, 200);
  assert.equal(result.body.ignored, true);
  assert.equal(fakeStore.markedPaid.length, 0);
});
