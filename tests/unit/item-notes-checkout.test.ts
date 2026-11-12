import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as noteHelpers from "../../src/lib/orders/order-item-notes";
import { normalizeCustomerPaymentPhone } from "../../src/lib/payments/customer-ussd";

type Row = Record<string, unknown>;
function load(path: string, dependencies: Record<string, unknown>) {
  const exports: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
  const source = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { exports, require: (name: string) => dependencies[name] ?? {}, Date, crypto: { randomUUID }, console: { error() {} } });
  return exports;
}
class Decimal { constructor(private value: number) {} valueOf() { return this.value; } }
const types = {
  Prisma: { Decimal, PrismaClientKnownRequestError: class extends Error {} },
  CustomerCheckoutStatus: { PAYMENT_RECEIVED: "PAYMENT_RECEIVED", NEEDS_HELP: "NEEDS_HELP", PAID: "PAID" },
  MobileMoneyReceiptStatus: { ASSIGNED: "ASSIGNED" },
};

async function start(note: unknown) {
  let saved: Row | undefined;
  const prisma = {
    product: { findMany: async () => [{ id: "tea", name: "Tea", price: 5, category: { station: "KITCHEN" }, recipeVersions: [] }] },
    customerCheckout: {
      findUnique: async () => null,
      create: async ({ data }: { data: Row }) => { saved = data; return { id: "checkout", status: "PENDING" }; },
    },
  };
  const server = load("src/app/api/customer/checkouts/route.ts", {
    "next/server": { NextResponse: { json: (body: unknown, init?: { status: number }) => ({ body, status: init?.status ?? 200 }) } },
    "@prisma/client": types,
    "@/lib/prisma": { prisma },
    "@/lib/auth/api-authorization": { authorizeApi: async () => ({ ok: true, user: { id: "customer", role: "CUSTOMER", fullName: "Customer" } }) },
    "@/lib/auth/permissions": { PERMISSIONS: {} },
    "@/lib/payments/customer-ussd": { normalizeCustomerPaymentPhone },
    "@/lib/orders/order-item-notes": noteHelpers,
    "@/lib/inventory/inventory-domain": { selectEffectiveRecipe: () => null, snapshotInventoryCost: () => ({ unitCostSnapshot: null, costSnapshotSource: null, recipeVersionId: null }) },
  });
  const response = await server.POST({ json: async () => ({ paymentPhone: "901234567", idempotencyKey: randomUUID(), items: [{ productId: "tea", qty: 1, note }] }) }) as { status: number };
  return { saved, response };
}

test("checkout rejects invalid instructions before writing a payment snapshot", async () => {
  for (const value of [false, { text: "no sugar" }, "x".repeat(501)]) {
    const result = await start(value);
    assert.equal(result.response.status, 400);
    assert.equal(result.saved, undefined);
  }
});

test("verified payment copies the original item instructions into order and kitchen lines", async () => {
  const created = await start("  No sugar  ");
  assert.equal(created.response.status, 201);
  assert.equal((created.saved?.snapshot as Row[])[0].notes, "No sugar");
  let orderItems: Row[] = [], kitchenLines: Row[] = [];
  const checkout = { ...created.saved, id: "checkout", status: "PAYMENT_RECEIVED", receiptId: "receipt" };
  const tx = {
    $queryRaw: async () => [],
    customerCheckout: { findUnique: async () => checkout, update: async () => {} },
    mobileMoneyReceipt: { findUnique: async () => ({ id: "receipt", status: "ASSIGNED", amount: 5, providerReference: "payment" }) },
    order: { create: async () => ({ id: "order", orderNumber: 1 }) },
    orderItem: { createMany: async ({ data }: { data: Row[] }) => { orderItems = data; } },
    payment: { create: async () => {} },
  };
  const server = load("src/lib/payments/customer-checkout.ts", {
    "@prisma/client": types,
    "@/lib/prisma": { prisma: { $transaction: async (fn: (value: typeof tx) => unknown) => fn(tx) } },
    "@/lib/kitchen/kitchen-tickets": { createKitchenTicketState: async (_: unknown, value: { lines: Row[] }) => { kitchenLines = value.lines; } },
    "@/lib/staff/customer-order-dispatch": { dispatchCustomerOrder: async () => {} },
    "@/lib/inventory/inventory": { deductProductInventoryForSale: async () => [], sendInventoryAlerts: async () => {} },
    "@/lib/posthog-server": { getPostHogClient: () => null },
  });
  const order = await server.finalizeCustomerCheckout("checkout") as Row;
  assert.equal(order.id, "order");
  assert.equal(orderItems[0].notes, "No sugar");
  assert.equal(kitchenLines[0].notes, "No sugar");
});
