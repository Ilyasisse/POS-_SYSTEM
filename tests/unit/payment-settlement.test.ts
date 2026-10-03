/* eslint-disable @typescript-eslint/no-explicit-any -- isolated adapters execute transpiled server modules. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as client from "@prisma/client";
import * as zod from "zod";
import * as webhook from "../../src/lib/payments/mycash-golis-webhook";
import * as adjustmentRules from "../../src/lib/sales/adjustment-rules";

// Run production routes/services with isolated persistence and side effects.
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
    console,
    process,
  });
  return exports;
}

const settlement = loadModule("src/lib/payments/order-settlement.ts", {});
const next = {
  NextResponse: {
    json: (body: unknown, options?: { status: number }) => ({
      body,
      status: options?.status ?? 200,
    }),
  },
};

function fixture(initialPaid = 0) {
  const state = {
    order: {
      id: "order",
      orderNumber: 10,
      tableId: "table",
      tableCheckId: null,
      tableCheckRound: null,
      tableCheck: null,
      status: "OPEN",
      total: 10,
    },
    payments: initialPaid
      ? [{ orderId: "order", amountPaid: initialPaid, reference: "initial" }]
      : ([] as any[]),
  };
  let tableQueue = Promise.resolve();
  const snapshot = () => ({
    ...state.order,
    payments: state.payments.map((p) => ({ ...p })),
  });
  const order = {
    findUnique: async () => snapshot(),
    findMany: async ({ where }: any) =>
      where.status && state.order.status !== where.status ? [] : [snapshot()],
    update: async ({ data }: any) => Object.assign(state.order, data),
    updateMany: async ({ data }: any) => {
      Object.assign(state.order, data);
      return { count: 1 };
    },
    count: async () => (state.order.status === "OPEN" ? 1 : 0),
  };
  const payment = {
    create: async ({ data }: any) => {
      await Promise.resolve();
      if (
        data.reference &&
        state.payments.some(
          (p) => p.method === data.method && p.reference === data.reference,
        )
      ) {
        throw new client.Prisma.PrismaClientKnownRequestError(
          "Duplicate payment reference",
          { code: "P2002", clientVersion: "test" },
        );
      }
      state.payments.push({ ...data, amountPaid: Number(data.amountPaid) });
    },
    createMany: async ({ data }: any) => {
      for (const row of data) await payment.create({ data: row });
    },
    findFirst: async ({ where }: any) =>
      state.payments.find((p) => p.reference === where.reference) ?? null,
  };
  const prisma: Record<string, any> = {
    order,
    payment,
    staff: {
      findUnique: async () => ({
        id: "cashier",
        fullName: "Cashier",
        role: "CASHIER",
        isActive: true,
      }),
    },
    tableCheck: {
      findUnique: async () => null,
      updateMany: async () => ({ count: 0 }),
    },
    paymentDeferral: { updateMany: async () => ({ count: 0 }) },
    $transaction: async (run: (tx: any) => Promise<unknown>) => {
      let release: (() => void) | undefined;
      let locked = false;
      const tx: Record<string, any> = {
        ...prisma,
        $queryRawUnsafe: async (sql: string) => {
          if (sql.includes('FROM "Table"') && !locked) {
            const preceding = tableQueue;
            tableQueue = new Promise<void>((resolve) => {
              release = resolve;
            });
            await preceding;
            locked = true;
          }
          return [];
        },
      };
      tx.$queryRaw = (query: client.Prisma.Sql) =>
        tx.$queryRawUnsafe(query.sql);
      try {
        return await run(tx);
      } finally {
        release?.();
      }
    },
  };
  return { state, prisma };
}

function payRoute(
  prisma: Record<string, any>,
  posthog: () => unknown = () => null,
) {
  return loadModule("src/app/api/orders/pay/route.ts", {
    "next/server": next,
    "@prisma/client": client,
    "@/lib/prisma": { prisma },
    "@/lib/payments/order-settlement": settlement,
    "@/lib/supabase/server": {
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: "cashier" } } }) },
      }),
    },
    "@/lib/auth/permissions": { hasPermission: () => true, PERMISSIONS: {} },
    "@/lib/cashier/table-checks": {
      closeSettledTableChecks: async () => {},
      resolveTableCheckIdentity: () => ({ orderNumber: 10 }),
    },
    "@/lib/posthog-server": { getPostHogClient: posthog },
  });
}
const payRequest = () => ({
  json: async () => ({ orderId: "order", paymentMethod: "OTHER" }),
});

test("pay order settles only the unpaid remainder of a split payment", async () => {
  const f = fixture(4);
  const response = await payRoute(f.prisma).POST(payRequest());
  assert.equal(response.status, 200);
  assert.equal(f.state.payments[1].amountPaid, 6);
  assert.equal(f.state.order.status, "PAID");
});

test("concurrent pay order submissions create one payment and return a conflict for the retry", async () => {
  const f = fixture();
  const route = payRoute(f.prisma);
  const results = await Promise.all([
    route.POST(payRequest()),
    route.POST(payRequest()),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal(f.state.payments.length, 1);
  assert.equal(f.state.payments[0].amountPaid, 10);
});

test("analytics failure after payment commit still returns payment success", async () => {
  const f = fixture();
  const route = payRoute(f.prisma, () => ({
    capture: () => {},
    flush: async () => {
      throw new Error("analytics unavailable");
    },
  }));
  const response = await route.POST(payRequest());
  assert.equal(response.status, 200);
  assert.equal(f.state.order.status, "PAID");
  assert.equal(f.state.payments.length, 1);
});

test("cashier table settlement preserves previous payments", async () => {
  const f = fixture(4);
  const action = loadModule("src/app/cashier/actions.ts", {
    "@prisma/client": client,
    "@/lib/prisma": { prisma: f.prisma },
    "next/cache": { revalidatePath: () => {} },
    "next/navigation": {
      redirect: (path: string) => {
        throw new Error(path);
      },
    },
    "@/lib/auth/permissions": { PERMISSIONS: {} },
    "@/lib/auth/require-permission": {
      requirePermission: async () => ({ id: "cashier", fullName: "Cashier" }),
    },
    "@/lib/cashier/table-checks": { closeSettledTableChecks: async () => {} },
    "@/lib/payments/order-settlement": settlement,
    "@/lib/posthog-server": { getPostHogClient: () => null },
  });
  const form = new FormData();
  form.set("tableId", "table");
  form.set("paymentMethod", "OTHER");
  await assert.rejects(
    action.payOpenTableOrdersFromCashier(form),
    /payment_saved/,
  );
  assert.equal(f.state.payments[1].amountPaid, 6);
});

function webhookRoute(prisma: Record<string, any>) {
  return loadModule("src/app/api/webhooks/payments/mycash-golis/route.ts", {
    "next/server": next,
    "@prisma/client": client,
    "@/lib/prisma": { prisma },
    "@/lib/payments/order-settlement": settlement,
    "@/lib/cashier/table-checks": { closeSettledTableChecks: async () => {} },
    "@/lib/payments/mycash-golis-webhook": {
      ...webhook,
      readPaymentWebhookConfig: () => ({
        ok: true,
        secret: "secret",
        cashierId: "cashier",
      }),
      verifyPaymentWebhookSignature: () => true,
    },
  });
}
const webhookRequest = (amount: number, reference = "reference") => ({
  text: async () =>
    JSON.stringify({
      provider: "GOLIS",
      status: "SUCCESS",
      orderId: "order",
      amount,
      reference,
    }),
  headers: { get: () => "signature" },
});

test("webhook accepts the remaining balance after a partial payment", async () => {
  const f = fixture(4);
  const response = await webhookRoute(f.prisma).POST(webhookRequest(6));
  assert.equal(response.status, 200);
  assert.equal(f.state.payments[1].amountPaid, 6);
  assert.equal(f.state.order.status, "PAID");
});

test("webhook rechecks paid state inside its transaction for concurrent different references", async () => {
  const f = fixture();
  const route = webhookRoute(f.prisma);
  const results = await Promise.all([
    route.POST(webhookRequest(10, "one")),
    route.POST(webhookRequest(10, "two")),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal(f.state.payments.length, 1);
});

test("webhook retries with the same reference remain idempotent during concurrent delivery", async () => {
  const f = fixture();
  const route = webhookRoute(f.prisma);
  const results = await Promise.all([
    route.POST(webhookRequest(10)),
    route.POST(webhookRequest(10)),
  ]);
  assert.deepEqual(
    results.map((r) => r.status),
    [200, 200],
  );
  assert.equal(f.state.payments.length, 1);
});

test("different payer rows see the current table balance during concurrent receipt assignments", async () => {
  const f = fixture();
  const now = new Date();
  const requests = ["one", "two"].map((id) => ({
    id,
    tableId: "table",
    cashierId: "cashier",
    cashierName: "Cashier",
    status: "PENDING",
    expiresAt: new Date(now.getTime() + 60000),
    method: "GOLIS",
    expectedAmount: 5,
    payments: [],
  }));
  const receipts = ["one", "two"].map((id) => ({
    id,
    status: "AVAILABLE",
    direction: "INCOMING",
    method: "GOLIS",
    transactionAt: now,
    amount: 5,
    providerReference: id,
    assignedPaymentRequestId: null,
  }));
  f.prisma.paymentRequest = {
    findUnique: async ({ where }: any) =>
      requests.find((r) => r.id === where.id),
    update: async ({ where, data }: any) =>
      Object.assign(
        requests.find((r) => r.id === where.id)!,
        data,
      ),
  };
  f.prisma.mobileMoneyReceipt = {
    findUnique: async ({ where }: any) =>
      receipts.find((r) => r.id === where.id),
    findUniqueOrThrow: async ({ where }: any) =>
      receipts.find((r) => r.id === where.id),
    updateMany: async ({ where, data }: any) => {
      Object.assign(
        receipts.find((r) => r.id === where.id)!,
        data,
      );
      return { count: 1 };
    },
  };
  const receiptsService = loadModule(
    "src/lib/payments/mobile-money-receipts.ts",
    {
      "@prisma/client": client,
      "@/lib/prisma": { prisma: f.prisma },
      "@/lib/payments/order-settlement": settlement,
      "@/lib/cashier/table-checks": { closeSettledTableChecks: async () => {} },
      "@/lib/cashier/cashier-business-day": {
        getPaymentReceiptBusinessDayRange: () => ({
          start: new Date(0),
          end: new Date(now.getTime() + 60000),
        }),
      },
    },
  );
  await Promise.all(
    ["one", "two"].map((id) =>
      receiptsService.assignMobileMoneyReceipt({
        receiptId: id,
        paymentRequestId: id,
        cashier: { id: "cashier", fullName: "Cashier" },
        now,
      }),
    ),
  );
  assert.equal(
    f.state.payments.reduce((sum, p) => sum + p.amountPaid, 0),
    10,
  );
  assert.equal(f.state.order.status, "PAID");
});

test("concurrent legacy request matches cannot settle the same payer twice", async () => {
  const f = fixture();
  const request = {
    id: "request",
    tableId: "table",
    cashierId: "cashier",
    cashierName: "Cashier",
    method: "GOLIS",
    status: "PENDING",
    expiresAt: new Date(Date.now() + 60000),
    expectedAmount: 10,
  };
  f.prisma.paymentRequest = {
    findUnique: async () => ({ ...request }),
    findFirst: async () => null,
    update: async ({ data }: any) => Object.assign(request, data),
  };
  const requestsService = loadModule(
    "src/lib/payments/cashier-payment-requests.ts",
    {
      "@prisma/client": client,
      "@/lib/prisma": { prisma: f.prisma },
      "@/lib/payments/order-settlement": settlement,
      "@/lib/cashier/table-checks": { closeSettledTableChecks: async () => {} },
    },
  );
  const responses = await Promise.all(
    ["one", "two"].map((reference) =>
      requestsService.matchPaymentRequest({
        paymentRequestId: "request",
        reference,
        amount: 10,
        sender: process.env.MACRODROID_PAYMENT_SMS_SENDER?.trim() || "A98",
        rawMessage: "SMS",
      }),
    ),
  );
  assert.equal(f.state.payments.length, 1);
  assert.equal(responses.filter((r) => r.duplicate).length, 1);
});

test("payment batch retries cannot expose or reuse another cashier's table requests", async () => {
  const existing = {
    id: "request",
    batchKey: "batch",
    cashierId: "owner",
    tableId: "table",
    method: "GOLIS",
  };
  const requestsService = loadModule(
    "src/lib/payments/cashier-payment-requests.ts",
    {
      "@prisma/client": client,
      "@/lib/prisma": {
        prisma: { paymentRequest: { findMany: async () => [existing] } },
      },
    },
  );
  const input = {
    batchKey: "batch",
    tableId: "table",
    cashier: { id: "owner", fullName: "Owner" },
    method: "GOLIS",
    lines: [],
    payLater: false,
  };
  for (const changed of [
    { cashier: { id: "another", fullName: "Other" } },
    { tableId: "another" },
    { method: "OTHER" },
    { batchKey: "" },
  ]) {
    await assert.rejects(
      requestsService.createPaymentRequestBatch({ ...input, ...changed }),
    );
  }
  const repeated = await requestsService.createPaymentRequestBatch(input);
  assert.equal(repeated[0].id, "request");
});

test("receipt reversal stops if the assignment changed while waiting for its table lock", async () => {
  const f = fixture(5);
  let reads = 0;
  let deletions = 0;
  f.prisma.mobileMoneyReceipt = {
    findUnique: async () => ({
      id: "receipt",
      status: "ASSIGNED",
      paymentRequest:
        reads++ === 0
          ? { id: "original", tableId: "table" }
          : { id: "reassigned", tableId: "other-table" },
    }),
  };
  f.prisma.payment.deleteMany = async () => {
    deletions++;
  };
  const receiptsService = loadModule(
    "src/lib/payments/mobile-money-receipts.ts",
    {
      "@prisma/client": client,
      "@/lib/prisma": { prisma: f.prisma },
      "@/lib/payments/order-settlement": settlement,
    },
  );
  await assert.rejects(
    receiptsService.reverseMobileMoneyReceipt({
      receiptId: "receipt",
      actor: { id: "manager", fullName: "Manager" },
      reason: "Wrong receipt assigned",
    }),
    /assignment changed/,
  );
  assert.equal(deletions, 0);
  assert.equal(f.state.payments.length, 1);
});

test("concurrent refunds cannot jointly exceed the amount paid", async () => {
  const f = fixture(10);
  f.state.order.status = "PAID";
  const refunds: Array<{ type: string; amount: client.Prisma.Decimal }> = [];
  f.prisma.order.findUnique = async () => ({
    ...f.state.order,
    total: new client.Prisma.Decimal(10),
    payments: f.state.payments,
    orderItems: [],
    salesAdjustments: refunds.map((r) => ({ ...r })),
  });
  f.prisma.salesAdjustment = {
    create: async ({ data }: any) => {
      refunds.push(data);
      return { id: "adjustment", ...data };
    },
  };
  f.prisma.auditLog = { create: async () => ({}) };
  const adjustmentsService = loadModule("src/lib/sales/adjustments.ts", {
    "@prisma/client": client,
    zod,
    "@/lib/payments/order-settlement": settlement,
    "@/lib/sales/adjustment-rules": adjustmentRules,
  });
  const responses = await Promise.allSettled(
    ["one", "two"].map(() =>
      f.prisma.$transaction((tx: unknown) =>
        adjustmentsService.createSalesAdjustment(tx, {
          orderId: "order",
          type: "REFUND",
          amount: "7",
          reason: "Customer refund",
          actorUserId: "manager",
          approvedByUserId: "manager",
        }),
      ),
    ),
  );
  assert.equal(responses.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(responses.filter((r) => r.status === "rejected").length, 1);
  assert.equal(
    refunds.reduce((sum, r) => sum + Number(r.amount), 0),
    7,
  );
});
