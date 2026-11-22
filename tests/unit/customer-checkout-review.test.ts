import { expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";

import vm from "node:vm";
import ts from "typescript";
import {
  chooseUniqueCustomerCheckout,
  customerPaymentNameMatches,
  normalizeSomaliPhone,
} from "../../src/lib/payments/customer-ussd";

type CheckoutService = Pick<
  typeof import("../../src/lib/payments/customer-checkout"),
  "assignCustomerCheckoutReceipt" | "retryCustomerCheckoutPayment" | "autoMatchCustomerReceipt"
>;

interface ReviewAudit {
  action: string;
  actorUserId: string | null;
  reason: string | null;
  newValue: { allowExceptions: boolean };
}

interface UpdateData<T> {
  data: Partial<T>;
}

interface ReviewRoute {
  POST(request: unknown, context: { params: Promise<{ id: string }> }): Promise<unknown>;
}

interface NotificationResponse {
  body: {
    paymentReview?: { checkouts: number; receipts: number };
    error?: string;
  };
  options: { headers?: Record<string, string>; status?: number };
}

interface NotificationRoute {
  GET(): Promise<NotificationResponse>;
}

// Execute the actual server module with isolated database/side-effect adapters.
function loadModule<ModuleExports extends object>(
  path: string,
  dependencies: Record<string, unknown>,
): ModuleExports {
  const output = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports: Record<string, unknown> = {};
  vm.runInNewContext(output, {
    exports,
    require: (name: string) => dependencies[name] ?? {},
    Date,
    crypto: globalThis.crypto,
    console,
  });
  return exports as ModuleExports;
}
const statuses = Object.fromEntries(
  ["PENDING", "REVIEW", "EXPIRED", "PAYMENT_RECEIVED", "NEEDS_HELP", "PAID"].map((s) => [s, s]),
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
  const audits: ReviewAudit[] = [];
  const prisma = {
    customerCheckout: {
      findUnique: async () => checkout,
      findMany: async () => (ambiguous ? [checkout, { ...checkout, id: "other" }] : [checkout]),
      updateMany: async ({ data }: UpdateData<typeof checkout>) => {
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
      create: async ({ data }: { data: ReviewAudit }) => {
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
  const checkoutService = loadModule<CheckoutService>("src/lib/payments/customer-checkout.ts", {
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
    assign: (
      input: Partial<Parameters<CheckoutService["assignCustomerCheckoutReceipt"]>[0]> = {},
    ) =>
      checkoutService.assignCustomerCheckoutReceipt({
        checkoutId: checkout.id,
        receiptId: receipt.id,
        ...input,
      }),
    retry: () => checkoutService.retryCustomerCheckoutPayment(checkout.id),
    autoMatch: () => checkoutService.autoMatchCustomerReceipt(receipt.id),
    claims: () => claims,
    audits,
  };
}

test("review retry claims an existing matching receipt only once", async () => {
  const f = fixture();
  await f.retry();
  await f.retry();
  expect(f.claims()).toBe(1);
  expect(f.checkout.receiptId).toBe("receipt");
});
test("review retry does not bypass ambiguity or payer matching", async () => {
  for (const f of [fixture(true), fixture(false, "252905109688")]) {
    await f.retry();
    expect(f.claims()).toBe(0);
  }
});
test("expired checkouts stay available for staff review without automatic assignment", async () => {
  const f = fixture();
  f.checkout.expiresAt = new Date(0);
  await f.retry();
  expect(f.claims()).toBe(0);
});
test("review endpoint accepts repeated review and invokes reconciliation", async () => {
  let retries = 0;
  const route = loadModule<ReviewRoute>("src/app/api/customer/checkouts/[id]/review/route.ts", {
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
          updateMany: async ({
            where,
          }: {
            where: { customerId: string; status: { in: string[] } };
          }) => {
            expect(where.customerId).toBe("customer");
            expect(where.status.in.includes("REVIEW")).toBeTruthy();
            return { count: 1 };
          },
        },
      },
    },
    "@/lib/payments/customer-checkout": {
      retryCustomerCheckoutPayment: async (id: string) => {
        expect(id).toBe("checkout");
        retries++;
      },
    },
  });
  await route.POST({}, { params: Promise.resolve({ id: "checkout" }) });
  expect(retries).toBe(1);
});

test("cashier review cannot bypass phone/time checks; admin exception needs a reason", async () => {
  const wrongPhone = fixture(false, "252901234567");
  await expect(
    wrongPhone.assign({
      staff: { id: "cashier", fullName: "Cashier" },
      reviewReason: "Verified SMS",
    }),
  ).rejects.toThrow(/admin or manager/);
  expect(wrongPhone.claims()).toBe(0);
  await expect(
    wrongPhone.assign({
      staff: { id: "admin", fullName: "Admin" },
      allowExceptions: true,
      reviewReason: "",
    }),
  ).rejects.toThrow(/admin or manager/);
  expect(wrongPhone.claims()).toBe(0);
  await wrongPhone.assign({
    staff: { id: "admin", fullName: "Admin" },
    allowExceptions: true,
    reviewReason: "Verified payer with customer",
  });
  expect(wrongPhone.claims()).toBe(1);
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
    await expect(
      f.assign({
        staff: { id: "admin", fullName: "Admin" },
        allowExceptions: true,
        reviewReason: "Reviewed original receipt",
      }),
    ).rejects.toThrow();
    expect(f.claims()).toBe(0);
  }
});
test("completed receipt assignment cannot be performed again", async () => {
  const f = fixture();
  await f.assign();
  await expect(f.assign()).rejects.toThrow(/already settled/);
  expect(f.claims()).toBe(1);
});

test("name mismatch queues review without consuming the payment", async () => {
  const f = fixture();
  f.checkout.status = "PENDING";
  f.receipt.counterpartyLabel = "Ali Yusuf Ahmed";
  await f.autoMatch();
  expect(f.checkout.status).toBe("REVIEW");
  expect(f.checkout.receiptId).toBe(null);
  expect(f.receipt.status).toBe("AVAILABLE");
  expect(f.claims()).toBe(0);
});

test("name check is enforced again during assignment and manager exceptions are audited", async () => {
  const f = fixture();
  f.receipt.counterpartyLabel = "Ali Yusuf Ahmed";
  await expect(f.assign()).rejects.toThrow(/Name, phone, or payment window/);
  await expect(
    f.assign({
      staff: { id: "cashier", fullName: "Cashier" },
      reviewReason: "Verified SMS",
    }),
  ).rejects.toThrow(/admin or manager/);
  await f.assign({
    staff: { id: "manager", fullName: "Manager" },
    allowExceptions: true,
    reviewReason: "Verified original SMS and customer identity",
  });
  expect(f.claims()).toBe(1);
  expect(f.audits[0].action).toBe("customer_checkout.receipt_reviewed");
  expect(f.audits[0].actorUserId).toBe("manager");
  expect(f.audits[0].newValue.allowExceptions).toBe(true);
  expect(f.audits[0].reason).toBe("Verified original SMS and customer identity");
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
    expect(f.checkout.status).toBe("REVIEW");
    expect(f.claims()).toBe(0);
    expect(f.receipt.status).toBe("AVAILABLE");
  }
});

test("manager notification API reports unresolved payment counts and clears when resolved", async () => {
  let role = "MANAGER";
  let unresolved = true;
  const route = loadModule<NotificationRoute>(
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
            count: async ({ where }: { where: { status: { in: string[] } } }) => {
              expect(Array.from(where.status.in)).toStrictEqual(["REVIEW", "NEEDS_HELP"]);
              return unresolved ? 2 : 0;
            },
          },
          mobileMoneyReceipt: {
            count: async ({
              where,
            }: {
              where: {
                OR: Array<{
                  status: string;
                  direction?: string;
                  assignedPaymentRequestId?: string | null;
                }>;
              };
            }) => {
              expect(where.OR[0].status).toBe("AVAILABLE");
              expect(where.OR[0].direction).toBe("INCOMING");
              expect(where.OR[0].assignedPaymentRequestId).toBe(null);
              expect(where.OR[1].status).toBe("NEEDS_REVIEW");
              return unresolved ? 3 : 0;
            },
          },
        },
      },
    },
  );
  let response = await route.GET();
  expect(response.body.paymentReview).toBeTruthy();
  if (!response.body.paymentReview)
    throw new Error("Expected response.body.paymentReview to be present");
  expect(response.options.headers).toBeTruthy();
  if (!response.options.headers) throw new Error("Expected response.options.headers to be present");
  expect(response.body.paymentReview.checkouts).toBe(2);
  expect(response.body.paymentReview.receipts).toBe(3);
  expect(response.options.headers["Cache-Control"]).toBe("private, no-store");
  unresolved = false;
  role = "ADMIN";
  response = await route.GET();
  expect(response.body.paymentReview).toBeTruthy();
  if (!response.body.paymentReview)
    throw new Error("Expected response.body.paymentReview to be present");
  expect(response.body.paymentReview.checkouts).toBe(0);
  expect(response.body.paymentReview.receipts).toBe(0);
  role = "CUSTOMER";
  response = await route.GET();
  expect(response.options.status).toBe(403);
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
    receiptId: null as string | null,
    orderType: "TAKEOUT",
    tableId: null,
    orderId: null as string | null,
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
  const db = {
    $queryRaw: async () => [],
    customerCheckout: {
      findUnique: async () => checkout,
      findMany: async () => [checkout],
      updateMany: async ({ data }: UpdateData<typeof checkout>) => {
        Object.assign(checkout, data);
        return { count: 1 };
      },
      update: async ({ data }: UpdateData<typeof checkout>) => {
        Object.assign(checkout, data);
        return checkout;
      },
    },
    mobileMoneyReceipt: {
      findUnique: async () => receipt,
      updateMany: async ({ data }: UpdateData<typeof receipt>) => {
        Object.assign(receipt, data);
        return { count: 1 };
      },
    },
    auditLog: { create: async () => ({}) },
    order: {
      create: async ({ data }: { data: { status: string; total: number } }) => {
        expect(data.status).toBe("PAID");
        expect(data.total).toBe(26);
        events.push("order");
        return order;
      },
    },
    orderItem: {
      createMany: async ({ data }: { data: Array<{ productId: string; qty: number }> }) => {
        expect(data[0].productId).toBe("coffee");
        expect(data[0].qty).toBe(2);
        events.push("items");
      },
    },
    payment: {
      create: async ({ data }: { data: { reference: string; amountPaid: number } }) => {
        expect(data.reference).toBe("unique-ref");
        expect(data.amountPaid).toBe(26);
        events.push("payment");
      },
    },
    $transaction: async (run: (tx: unknown) => Promise<unknown>): Promise<unknown> => run(db),
  };
  const service = loadModule<CheckoutService>("src/lib/payments/customer-checkout.ts", {
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
      dispatchCustomerOrder: async (_tx: unknown, input: { orderId: string }) => {
        expect(input.orderId).toBe(order.id);
        events.push("dispatch");
      },
    },
    "@/lib/kitchen/kitchen-tickets": {
      createKitchenTicketState: async (
        _tx: unknown,
        input: { orderId: string; lines: Array<{ qty: number }> },
      ) => {
        expect(input.orderId).toBe(order.id);
        expect(input.lines[0].qty).toBe(2);
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
  expect(checkout.status).toBe("PAID");
  expect(checkout.orderId).toBe(order.id);
  expect(checkout.receiptId).toBe(receipt.id);
  expect(receipt.status).toBe("ASSIGNED");
  expect(events).toStrictEqual(["order", "dispatch", "items", "payment", "kitchen", "inventory"]);
});
