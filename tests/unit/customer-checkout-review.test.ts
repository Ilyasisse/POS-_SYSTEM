import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import {
  chooseUniqueCustomerCheckout,
  customerPaymentNameMatches,
  normalizeSomaliPhone,
} from "../../src/lib/payments/customer-ussd";

// Execute the actual server module with isolated database/side-effect adapters.
function loadModule(path: string, dependencies: Record<string, unknown>) {
  const output = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports: Record<string, any> = {};
  vm.runInNewContext(output, {
    exports,
    require: (name: string) => dependencies[name] ?? {},
    Date,
    crypto: globalThis.crypto,
    console,
  });
  return exports;
}
const statuses = Object.fromEntries(
  [
    "PENDING",
    "REVIEW",
    "EXPIRED",
    "PAYMENT_RECEIVED",
    "NEEDS_HELP",
    "PAID",
  ].map((s) => [s, s]),
);

function fixture(ambiguous = false, phone = "252905109687") {
  const now = Date.now();
  const checkout = {
    id: "checkout",
    customerName: "Ali Hassan",
    status: "REVIEW",
    receiptId: null as string | null,
    amount: 26,
    payerPhone: phone,
    createdAt: new Date(now - 60000),
    expiresAt: new Date(now + 60000),
  };
  const receipt = {
    id: "receipt",
    counterpartyLabel: "Ali Hassan Mohamed 252905109687",
    status: "AVAILABLE",
    direction: "INCOMING",
    method: "GOLIS",
    amount: 26,
    transactionAt: new Date(now - 30000),
    providerReference: "ref",
    counterpartyIdentifiers: ["252905109687"],
  };
  let claims = 0;
  const audits: any[] = [];
  const prisma = {
    customerCheckout: {
      findUnique: async () => checkout,
      findMany: async () =>
        ambiguous ? [checkout, { ...checkout, id: "other" }] : [checkout],
      updateMany: async ({ data }: any) => {
        if (data.status === "REVIEW") {
          checkout.status = "REVIEW";
          return { count: 1 };
        }
        checkout.receiptId = receipt.id;
        checkout.status = "PAYMENT_RECEIVED";
        return { count: 1 };
      },
    },
    mobileMoneyReceipt: {
      findMany: async () => [receipt],
      findUnique: async () => receipt,
      updateMany: async () => {
        claims++;
        receipt.status = "ASSIGNED";
        return { count: 1 };
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        audits.push(data);
        return {};
      },
    },
    $queryRaw: async () => [],
    $transaction: async (run: (tx: unknown) => Promise<unknown>) => {
      // Finalization is separately covered by the order flow; represent an
      // already completed order on its second transaction here.
      if (claims) checkout.status = "PAID";
      return run(prisma);
    },
  };
  const module = loadModule("src/lib/payments/customer-checkout.ts", {
    "@prisma/client": {
      CustomerCheckoutStatus: statuses,
      MobileMoneyReceiptStatus: {
        AVAILABLE: "AVAILABLE",
        ASSIGNED: "ASSIGNED",
      },
    },
    "@/lib/prisma": { prisma },
    "@/lib/payments/customer-ussd": {
      chooseUniqueCustomerCheckout,
      customerPaymentNameMatches,
      normalizeSomaliPhone,
    },
  });
  return {
    checkout,
    receipt,
    assign: (input: Record<string, unknown> = {}) =>
      module.assignCustomerCheckoutReceipt({
        checkoutId: checkout.id,
        receiptId: receipt.id,
        ...input,
      }),
    retry: () => module.retryCustomerCheckoutPayment(checkout.id),
    autoMatch: () => module.autoMatchCustomerReceipt(receipt.id),
    claims: () => claims,
    audits,
  };
}

test("review retry claims an existing matching receipt only once", async () => {
  const f = fixture();
  await f.retry();
  await f.retry();
  assert.equal(f.claims(), 1);
  assert.equal(f.checkout.receiptId, "receipt");
});
test("review retry does not bypass ambiguity or payer matching", async () => {
  for (const f of [fixture(true), fixture(false, "252905109688")]) {
    await f.retry();
    assert.equal(f.claims(), 0);
  }
});
test("expired checkouts stay available for staff review without automatic assignment", async () => {
  const f = fixture();
  f.checkout.expiresAt = new Date(0);
  await f.retry();
  assert.equal(f.claims(), 0);
});
test("review endpoint accepts repeated review and invokes reconciliation", async () => {
  let retries = 0;
  const route = loadModule(
    "src/app/api/customer/checkouts/[id]/review/route.ts",
    {
      "next/server": { NextResponse: { json: (body: unknown) => body } },
      "@/lib/auth/api-authorization": {
        authorizeApi: async () => ({
          ok: true,
          user: { id: "customer", role: "CUSTOMER" },
        }),
      },
      "@/lib/auth/permissions": { PERMISSIONS: {} },
      "@/lib/prisma": {
        prisma: {
          customerCheckout: {
            updateMany: async ({ where }: any) => {
              assert.equal(where.customerId, "customer");
              assert.ok(where.status.in.includes("REVIEW"));
              return { count: 1 };
            },
          },
        },
      },
      "@/lib/payments/customer-checkout": {
        retryCustomerCheckoutPayment: async (id: string) => {
          assert.equal(id, "checkout");
          retries++;
        },
      },
    },
  );
  await route.POST({}, { params: Promise.resolve({ id: "checkout" }) });
  assert.equal(retries, 1);
});

test("cashier review cannot bypass phone/time checks; admin exception needs a reason", async () => {
  const wrongPhone = fixture(false, "252901234567");
  await assert.rejects(
    wrongPhone.assign({
      staff: { id: "cashier", fullName: "Cashier" },
      reviewReason: "Verified SMS",
    }),
    /admin or manager/,
  );
  assert.equal(wrongPhone.claims(), 0);
  await assert.rejects(
    wrongPhone.assign({
      staff: { id: "admin", fullName: "Admin" },
      allowExceptions: true,
      reviewReason: "",
    }),
    /admin or manager/,
  );
  assert.equal(wrongPhone.claims(), 0);
  await wrongPhone.assign({
    staff: { id: "admin", fullName: "Admin" },
    allowExceptions: true,
    reviewReason: "Verified payer with customer",
  });
  assert.equal(wrongPhone.claims(), 1);
});
test("manual review never reuses processed, outgoing or wrong-amount receipts", async () => {
  for (const mutation of [
    (f: ReturnType<typeof fixture>) => {
      f.receipt.status = "ASSIGNED";
    },
    (f: ReturnType<typeof fixture>) => {
      f.receipt.direction = "OUTGOING";
    },
    (f: ReturnType<typeof fixture>) => {
      f.receipt.amount = 25;
    },
    (f: ReturnType<typeof fixture>) => {
      f.receipt.transactionAt = new Date(0);
    },
  ]) {
    const f = fixture();
    mutation(f);
    await assert.rejects(
      f.assign({
        staff: { id: "admin", fullName: "Admin" },
        allowExceptions: true,
        reviewReason: "Reviewed original receipt",
      }),
    );
    assert.equal(f.claims(), 0);
  }
});
test("completed receipt assignment cannot be performed again", async () => {
  const f = fixture();
  await f.assign();
  await assert.rejects(f.assign(), /already settled/);
  assert.equal(f.claims(), 1);
});

test("name mismatch queues review without consuming the payment", async () => {
  const f = fixture();
  f.checkout.status = "PENDING";
  f.receipt.counterpartyLabel = "Ali Yusuf Ahmed";
  await f.autoMatch();
  assert.equal(f.checkout.status, "REVIEW");
  assert.equal(f.checkout.receiptId, null);
  assert.equal(f.receipt.status, "AVAILABLE");
  assert.equal(f.claims(), 0);
});

test("name check is enforced again during assignment and manager exceptions are audited", async () => {
  const f = fixture();
  f.receipt.counterpartyLabel = "Ali Yusuf Ahmed";
  await assert.rejects(f.assign(), /Name, phone, or payment window/);
  await assert.rejects(
    f.assign({
      staff: { id: "cashier", fullName: "Cashier" },
      reviewReason: "Verified SMS",
    }),
    /admin or manager/,
  );
  await f.assign({
    staff: { id: "manager", fullName: "Manager" },
    allowExceptions: true,
    reviewReason: "Verified original SMS and customer identity",
  });
  assert.equal(f.claims(), 1);
  assert.equal(f.audits[0].action, "customer_checkout.receipt_reviewed");
  assert.equal(f.audits[0].actorUserId, "manager");
  assert.equal(f.audits[0].newValue.allowExceptions, true);
  assert.equal(
    f.audits[0].reason,
    "Verified original SMS and customer identity",
  );
});

test("wrong amount and late payments are queued for review without approval", async () => {
  for (const mutate of [
    (f: ReturnType<typeof fixture>) => {
      f.receipt.amount = 25;
    },
    (f: ReturnType<typeof fixture>) => {
      f.receipt.transactionAt = new Date(f.checkout.expiresAt.getTime() + 1000);
    },
  ]) {
    const f = fixture();
    f.checkout.status = "PENDING";
    mutate(f);
    await f.autoMatch();
    assert.equal(f.checkout.status, "REVIEW");
    assert.equal(f.claims(), 0);
    assert.equal(f.receipt.status, "AVAILABLE");
  }
});

test("manager notification API reports unresolved payment counts and clears when resolved", async () => {
  let role = "MANAGER";
  let unresolved = true;
  const route = loadModule(
    "src/app/api/staff/customer-order-notifications/route.ts",
    {
      "next/server": {
        NextResponse: {
          json: (body: unknown, options: unknown) => ({ body, options }),
        },
      },
      "@/lib/auth/current-user": {
        getCurrentUser: async () => ({ id: "manager", role, isActive: true }),
      },
      "@/lib/prisma": {
        prisma: {
          customerCheckout: {
            count: async ({ where }: any) => {
              assert.deepEqual(Array.from(where.status.in), [
                "REVIEW",
                "NEEDS_HELP",
              ]);
              return unresolved ? 2 : 0;
            },
          },
          mobileMoneyReceipt: {
            count: async ({ where }: any) => {
              assert.equal(where.OR[0].status, "AVAILABLE");
              assert.equal(where.OR[0].direction, "INCOMING");
              assert.equal(where.OR[0].assignedPaymentRequestId, null);
              assert.equal(where.OR[1].status, "NEEDS_REVIEW");
              return unresolved ? 3 : 0;
            },
          },
        },
      },
    },
  );
  let response = await route.GET();
  assert.equal(response.body.paymentReview.checkouts, 2);
  assert.equal(response.body.paymentReview.receipts, 3);
  assert.equal(response.options.headers["Cache-Control"], "private, no-store");
  unresolved = false;
  role = "ADMIN";
  response = await route.GET();
  assert.equal(response.body.paymentReview.checkouts, 0);
  assert.equal(response.body.paymentReview.receipts, 0);
  role = "CUSTOMER";
  response = await route.GET();
  assert.equal(response.options.status, 403);
});

test("a valid automatic match creates and dispatches one paid order", async () => {
  const now = Date.now();
  const checkout = {
    id: "checkout",
    customerId: "customer",
    customerName: "Ali Hassan",
    payerPhone: "252905109687",
    amount: 26,
    status: "PENDING",
    receiptId: null,
    orderType: "TAKEOUT",
    tableId: null,
    orderId: null,
    createdAt: new Date(now - 60000),
    expiresAt: new Date(now + 60000),
    snapshot: [
      {
        productId: "coffee",
        productName: "Coffee",
        qty: 2,
        station: "BARISTA",
        assignedBaristaId: "barista",
        assignedBaristaName: "Barista",
        unitPrice: 13,
        lineTotal: 26,
        modifiers: [],
        costSnapshot: {
          unitCostSnapshot: null,
          costSnapshotSource: null,
          recipeVersionId: null,
        },
      },
    ],
  };
  const receipt = {
    id: "receipt",
    status: "AVAILABLE",
    direction: "INCOMING",
    method: "GOLIS",
    amount: 26,
    counterpartyLabel: "Ali Hassan Mohamed 252905109687",
    counterpartyIdentifiers: [checkout.payerPhone],
    providerReference: "unique-ref",
    transactionAt: new Date(now - 30000),
    assignedPaymentRequestId: null,
  };
  const events: string[] = [];
  const order = { id: "order", orderNumber: 123, type: "TAKEOUT" };
  const db: any = {
    $queryRaw: async () => [],
    customerCheckout: {
      findUnique: async () => checkout,
      findMany: async () => [checkout],
      updateMany: async ({ data }: any) => {
        Object.assign(checkout, data);
        return { count: 1 };
      },
      update: async ({ data }: any) => {
        Object.assign(checkout, data);
        return checkout;
      },
    },
    mobileMoneyReceipt: {
      findUnique: async () => receipt,
      updateMany: async ({ data }: any) => {
        Object.assign(receipt, data);
        return { count: 1 };
      },
    },
    auditLog: { create: async () => ({}) },
    order: {
      create: async ({ data }: any) => {
        assert.equal(data.status, "PAID");
        assert.equal(data.total, 26);
        events.push("order");
        return order;
      },
    },
    orderItem: {
      createMany: async ({ data }: any) => {
        assert.equal(data[0].productId, "coffee");
        assert.equal(data[0].qty, 2);
        events.push("items");
      },
    },
    payment: {
      create: async ({ data }: any) => {
        assert.equal(data.reference, "unique-ref");
        assert.equal(data.amountPaid, 26);
        events.push("payment");
      },
    },
  };
  db.$transaction = async (run: (tx: unknown) => Promise<unknown>) => run(db);
  const service = loadModule("src/lib/payments/customer-checkout.ts", {
    "@prisma/client": {
      CustomerCheckoutStatus: statuses,
      MobileMoneyReceiptStatus: {
        AVAILABLE: "AVAILABLE",
        ASSIGNED: "ASSIGNED",
      },
      Prisma: {
        Decimal: class {
          constructor(public value: number) {}
        },
      },
    },
    "@/lib/prisma": { prisma: db },
    "@/lib/payments/customer-ussd": {
      chooseUniqueCustomerCheckout,
      customerPaymentNameMatches,
      normalizeSomaliPhone,
    },
    "@/lib/staff/customer-order-dispatch": {
      dispatchCustomerOrder: async (_tx: unknown, input: any) => {
        assert.equal(input.orderId, order.id);
        events.push("dispatch");
      },
    },
    "@/lib/kitchen/kitchen-tickets": {
      createKitchenTicketState: async (_tx: unknown, input: any) => {
        assert.equal(input.orderId, order.id);
        assert.equal(input.lines[0].qty, 2);
        events.push("kitchen");
      },
    },
    "@/lib/inventory/inventory": {
      deductProductInventoryForSale: async () => {
        events.push("inventory");
        return [];
      },
      sendInventoryAlerts: async () => {},
    },
    "@/lib/posthog-server": { getPostHogClient: () => null },
  });
  await service.autoMatchCustomerReceipt(receipt.id);
  await service.autoMatchCustomerReceipt(receipt.id);
  assert.equal(checkout.status, "PAID");
  assert.equal(checkout.orderId, order.id);
  assert.equal(checkout.receiptId, receipt.id);
  assert.equal(receipt.status, "ASSIGNED");
  assert.deepEqual(events, [
    "order",
    "dispatch",
    "items",
    "payment",
    "kitchen",
    "inventory",
  ]);
});
