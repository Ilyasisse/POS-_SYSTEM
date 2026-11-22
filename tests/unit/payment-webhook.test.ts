import { expect, test } from "@jest/globals";
import { createHmac } from "node:crypto";

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

function store(overrides: Partial<PaymentWebhookStore> = {}): PaymentWebhookStore & {
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
  expect(
    readPaymentWebhookConfig({
      PAYMENT_WEBHOOK_SECRET: " secret ",
      PAYMENT_WEBHOOK_CASHIER_ID: " cashier-1 ",
    }),
  ).toStrictEqual({
    ok: true,
    secret: "secret",
    cashierId: "cashier-1",
  });

  const rawBody = JSON.stringify(payload());
  const signature = signBody(rawBody, "secret");

  expect(verifyPaymentWebhookSignature(rawBody, null, "secret")).toBe(false);
  expect(verifyPaymentWebhookSignature(rawBody, "sha256=wrong", "secret")).toBe(false);
  expect(verifyPaymentWebhookSignature(rawBody, `sha256=${signature}`, "secret")).toBe(true);
  expect(
    verifyPaymentWebhookSignature(
      JSON.stringify(payload({ amount: 1 })),
      `sha256=${signature}`,
      "secret",
    ),
  ).toBe(false);
  expect(readPaymentWebhookConfig({ PAYMENT_WEBHOOK_CASHIER_ID: "cashier-1" }).ok).toBe(false);
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

  expect(result.ok).toBe(true);

  if (result.ok) {
    expect(result.event.provider).toBe("GOLIS");
    expect(result.event.status).toBe("PAID");
    expect(result.event.orderNumber).toBe(123);
    expect(result.event.amount).toBe(15.5);
    expect(result.event.isSuccess).toBe(true);
  }
});

test("rejects invalid webhook payloads", () => {
  expect(normalizeMycashGolisWebhookPayload(null).ok).toBe(false);
  expect(normalizeMycashGolisWebhookPayload(payload({ provider: "CARD" })).ok).toBe(false);
  expect(normalizeMycashGolisWebhookPayload(payload({ reference: "" })).ok).toBe(false);
  expect(normalizeMycashGolisWebhookPayload(payload({ orderId: "", orderNumber: "" })).ok).toBe(
    false,
  );
  expect(normalizeMycashGolisWebhookPayload(payload({ amount: 0 })).ok).toBe(false);
  expect(normalizeMycashGolisWebhookPayload(payload({ paidAt: "not-a-date" })).ok).toBe(false);
});

test("successful webhook marks an open order paid", async () => {
  const fakeStore = store();
  const result = await processMycashGolisWebhook(payload(), {
    cashierId: "cashier-1",
    store: fakeStore,
  });

  expect(result.status).toBe(200);
  expect(result.body.ok).toBe(true);
  expect(fakeStore.markedPaid.length).toBe(1);
  expect(fakeStore.markedPaid[0]).toStrictEqual({
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

  expect(result.status).toBe(200);
  expect(fakeStore.markedPaid[0]?.method).toBe("GOLIS");
  expect(fakeStore.markedPaid[0]?.reference).toBe("golis-transaction-7");
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

  expect(result.status).toBe(200);
  expect(result.body.duplicate).toBe(true);
  expect(fakeStore.markedPaid.length).toBe(0);
});

test("amount mismatch rejects without changing the order", async () => {
  const fakeStore = store({
    findOrder: async () => openOrder(20),
  });

  const result = await processMycashGolisWebhook(payload(), {
    cashierId: "cashier-1",
    store: fakeStore,
  });

  expect(result.status).toBe(400);
  expect(result.body.error).toBe("Payment amount does not match order total.");
  expect(fakeStore.markedPaid.length).toBe(0);
});

test("already-paid order with a new reference returns a conflict", async () => {
  const fakeStore = store({
    findOrder: async () => ({
      ...openOrder(),
      status: "PAID",
    }),
  });

  const result = await processMycashGolisWebhook(payload({ reference: "new-reference" }), {
    cashierId: "cashier-1",
    store: fakeStore,
  });

  expect(result.status).toBe(409);
  expect(result.body.error).toBe("Order is not open for payment.");
  expect(fakeStore.markedPaid.length).toBe(0);
});

test("failed provider status is ignored", async () => {
  const fakeStore = store();
  const result = await processMycashGolisWebhook(payload({ status: "FAILED" }), {
    cashierId: "cashier-1",
    store: fakeStore,
  });

  expect(result.status).toBe(200);
  expect(result.body.ignored).toBe(true);
  expect(fakeStore.markedPaid.length).toBe(0);
});
