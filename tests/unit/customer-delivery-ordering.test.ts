import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import {
  buildCustomerOrderNote,
  customerFulfillmentDestination,
  validateCustomerFulfillment,
  type CustomerFulfillmentType,
} from "../../src/lib/customer/customer-order-fulfillment";
import { normalizeCustomerPaymentPhone } from "../../src/lib/payments/customer-ussd";

type TestResponse = {
  status: number;
  body: {
    field?: string;
    error?: string;
    checkout?: Record<string, unknown>;
    orders?: Record<string, unknown>[];
  };
};

type ServerModule = {
  POST(request: Request): Promise<TestResponse>;
  GET(request?: Request, context?: { params: Promise<{ id: string }> }): Promise<TestResponse>;
  finalizeCustomerCheckout(id: string): Promise<Record<string, unknown> | null>;
};

// Run the actual server module with isolated database and side-effect adapters.
function loadModule(path: string, dependencies: Record<string, unknown>): ServerModule {
  const output = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, {
    exports,
    require: (name: string) => dependencies[name] ?? {},
    Date,
    crypto: { randomUUID },
    console: { error() {} },
  });
  return exports as ServerModule;
}

const fulfillmentDependency = {
  buildCustomerOrderNote,
  customerFulfillmentDestination,
  validateCustomerFulfillment,
};
const nextResponseDependency = {
  NextResponse: {
    json: (body: TestResponse["body"], options?: { status?: number }) => ({
      body,
      status: options?.status ?? 200,
    }),
  },
};
const authDependency = {
  authorizeApi: async () => ({ ok: true, user: { id: "customer-1", role: "CUSTOMER", fullName: "Amina" } }),
};
class Decimal {
  constructor(private value: number) {}
  valueOf() { return this.value; }
}
const prismaDependency = {
  Prisma: { Decimal },
  CustomerCheckoutStatus: Object.fromEntries([
    "PENDING", "REVIEW", "EXPIRED", "PAYMENT_RECEIVED", "NEEDS_HELP", "PAID",
  ].map(status => [status, status])),
  MobileMoneyReceiptStatus: { ASSIGNED: "ASSIGNED" },
};

function checkoutRouteFixture(activeTable = true) {
  const created: Record<string, unknown>[] = [];
  const route = loadModule("src/app/api/customer/checkouts/route.ts", {
    "next/server": nextResponseDependency,
    "@prisma/client": prismaDependency,
    "@/lib/auth/api-authorization": authDependency,
    "@/lib/auth/permissions": { PERMISSIONS: {} },
    "@/lib/customer/customer-order-fulfillment": fulfillmentDependency,
    "@/lib/payments/customer-ussd": { normalizeCustomerPaymentPhone },
    "@/lib/inventory/inventory-domain": {
      selectEffectiveRecipe: () => null,
      snapshotInventoryCost: () => ({ unitCostSnapshot: null, costSnapshotSource: null, recipeVersionId: null }),
    },
    "@/lib/prisma": { prisma: {
      table: { findFirst: async () => activeTable ? { id: "table-1" } : null },
      product: { findMany: async () => [{
        id: "product-1", name: "Tea", price: 2, cost: 1, recipeVersions: [], category: { station: "KITCHEN" },
      }] },
      customerCheckout: {
        findUnique: async () => null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          created.push(data);
          return { id: "checkout-1", status: "PENDING", ...data };
        },
      },
    } },
  });
  const post = (overrides: Record<string, unknown> = {}) => route.POST(new Request("https://example.test/api/customer/checkouts", {
    method: "POST",
    body: JSON.stringify({
      customerName: "  Amina  ", paymentPhone: "901234567", idempotencyKey: randomUUID(),
      orderType: "DELIVERY", tableId: "table-1", deliveryPhone: "+252 (61) 234-5678",
      deliveryAddress: "  Hodan, near the mosque  ", items: [{ productId: "product-1", qty: 2 }],
      ...overrides,
    }),
  }));
  return { post, created };
}

function finalizationFixture(orderType: CustomerFulfillmentType = "DELIVERY") {
  const checkout = {
    id: "checkout-1", customerId: "customer-1", customerName: "Amina",
    orderType, tableId: orderType === "DINE_IN" ? "table-1" : null,
    deliveryPhone: orderType === "DELIVERY" ? "+252 (61) 234-5678" : null,
    deliveryAddress: orderType === "DELIVERY" ? "Hodan, near the mosque" : null,
    payerPhone: "252901234567", amount: 4, status: "PAYMENT_RECEIVED", receiptId: "receipt-1",
    snapshot: [{
      productId: "product-1", productName: "Tea", qty: 2, station: "KITCHEN",
      assignedBaristaId: null, assignedBaristaName: null, unitPrice: 2, lineTotal: 4,
      costSnapshot: { unitCostSnapshot: null, costSnapshotSource: null, recipeVersionId: null }, modifiers: [],
    }],
  };
  const receipt = { id: "receipt-1", status: "ASSIGNED", amount: 4, providerReference: "receipt-ref", transactionAt: new Date(), assignedByUserId: null };
  const orders: Record<string, unknown>[] = [];
  const payments: Record<string, unknown>[] = [];
  const dispatches: Record<string, unknown>[] = [];
  const locks: string[] = [];
  let tickets = 0;
  let inventoryDeductions = 0;
  const database = {
    $queryRaw: async (parts: TemplateStringsArray) => { locks.push(parts.join("?")); return []; },
    customerCheckout: {
      findUnique: async () => checkout,
      update: async ({ data }: { data: Record<string, unknown> }) => { Object.assign(checkout, data); return checkout; },
      updateMany: async ({ data }: { data: Record<string, unknown> }) => { Object.assign(checkout, data); return { count: 1 }; },
    },
    mobileMoneyReceipt: { findUnique: async () => receipt },
    order: { create: async ({ data }: { data: Record<string, unknown> }) => { const order = { id: "order-1", orderNumber: 17, ...data }; orders.push(order); return order; } },
    table: { findUnique: async () => ({ name: "Table One" }) },
    orderItem: { createMany: async () => ({ count: 1 }) },
    payment: { create: async ({ data }: { data: Record<string, unknown> }) => { payments.push(data); return data; } },
  };
  const prisma = { ...database, $transaction: async (run: (tx: typeof database) => Promise<unknown>) => run(database) };
  const server = loadModule("src/lib/payments/customer-checkout.ts", {
    "@prisma/client": prismaDependency,
    "@/lib/prisma": { prisma },
    "@/lib/customer/customer-order-fulfillment": fulfillmentDependency,
    "@/lib/kitchen/kitchen-tickets": { createKitchenTicketState: async () => { tickets++; } },
    "@/lib/inventory/inventory": {
      deductProductInventoryForSale: async () => { inventoryDeductions++; return []; },
      sendInventoryAlerts: async () => {},
    },
    "@/lib/staff/customer-order-dispatch": { dispatchCustomerOrder: async (_tx: unknown, input: Record<string, unknown>) => { dispatches.push(input); } },
    "@/lib/posthog-server": { getPostHogClient: () => null },
  });
  return {
    checkout, receipt, orders, payments, dispatches, locks,
    finalize: () => server.finalizeCustomerCheckout(checkout.id),
    sideEffects: () => ({ tickets, inventoryDeductions }),
  };
}

test("pickup is the default and discards unused delivery and table details", () => {
  assert.deepEqual(validateCustomerFulfillment({
    customerName: "A", tableId: "table-1", deliveryPhone: "123456", deliveryAddress: "Unused address",
  }), { ok: true, value: { orderType: "TAKEOUT", customerName: "A", tableId: null, deliveryPhone: null, deliveryAddress: null } });
});

test("fulfillment validation returns the field to correct and accepts formatted delivery phones", () => {
  for (const orderType of ["COURIER", ""]) {
    const result = validateCustomerFulfillment({ orderType, customerName: "Amina" });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.field, "orderType");
  }
  for (const deliveryPhone of ["", "1234", "hello", "() --", "12-34", "1".repeat(31), {} as never]) {
    const result = validateCustomerFulfillment({ orderType: "DELIVERY", customerName: "Amina", deliveryPhone, deliveryAddress: "Hodan, near the mosque" });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.field, "deliveryPhone");
  }
  for (const deliveryAddress of ["", "Road", "x".repeat(501), {} as never]) {
    const result = validateCustomerFulfillment({ orderType: "DELIVERY", customerName: "Amina", deliveryPhone: "+252 (61) 234-5678", deliveryAddress });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.field, "deliveryAddress");
  }
  assert.equal(validateCustomerFulfillment({ orderType: "DELIVERY", customerName: "Amina", deliveryPhone: "+252 (61) 234-5678", deliveryAddress: "Hodan, near the mosque" }).ok, true);
});

test("dine-in retains its table while delivery ignores table state", () => {
  const missing = validateCustomerFulfillment({ orderType: "DINE_IN", customerName: "Amina" });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.field, "tableId");
  const dineIn = validateCustomerFulfillment({ orderType: "DINE_IN", customerName: "Amina", tableId: " table-1 " });
  assert.equal(dineIn.ok, true);
  if (dineIn.ok) assert.equal(dineIn.value.tableId, "table-1");
  assert.equal(customerFulfillmentDestination({ orderType: "DINE_IN", tableName: "Table One" }), "Table One");
  assert.equal(customerFulfillmentDestination({ orderType: "DELIVERY", deliveryAddress: "Hodan" }), "Delivery · Hodan");
});

test("checkout validates and stores delivery separately from the strict payer phone", async () => {
  const fixture = checkoutRouteFixture();
  const result = await fixture.post();
  assert.equal(result.status, 201);
  assert.equal(fixture.created.length, 1);
  assert.equal(fixture.created[0].payerPhone, "252901234567");
  assert.equal(fixture.created[0].deliveryPhone, "+252 (61) 234-5678");
  assert.equal(fixture.created[0].deliveryAddress, "Hodan, near the mosque");
  assert.equal(fixture.created[0].tableId, null);
  assert.equal(fixture.created[0].orderType, "DELIVERY");
  for (const overrides of [{ deliveryAddress: "" }, { deliveryPhone: "hello" }, { paymentPhone: "+252901234567" }]) {
    const rejected = checkoutRouteFixture();
    assert.equal((await rejected.post(overrides)).status, 400);
    assert.equal(rejected.created.length, 0);
  }
});

test("checkout retains active-table validation and clears delivery details outside delivery", async () => {
  for (const orderType of ["DINE_IN", "TAKEOUT"] as const) {
    const fixture = checkoutRouteFixture();
    assert.equal((await fixture.post({ orderType })).status, 201);
    assert.equal(fixture.created[0].deliveryPhone, null);
    assert.equal(fixture.created[0].deliveryAddress, null);
    assert.equal(fixture.created[0].tableId, orderType === "DINE_IN" ? "table-1" : null);
  }
  const inactive = checkoutRouteFixture(false);
  const response = await inactive.post({ orderType: "DINE_IN" });
  assert.equal(response.status, 400);
  assert.equal(response.body.field, "tableId");
  assert.equal(inactive.created.length, 0);
});

test("verified finalization propagates delivery into the paid order, kitchen note, and staff dispatch once", async () => {
  const fixture = finalizationFixture();
  const order = await fixture.finalize();
  assert.equal(order?.type, "DELIVERY");
  assert.equal(order?.deliveryPhone, "+252 (61) 234-5678");
  assert.equal(order?.deliveryAddress, "Hodan, near the mosque");
  assert.equal(order?.tableId, null);
  assert.match(String(order?.notes), /Delivery phone: \+252 \(61\) 234-5678/);
  assert.match(String(order?.notes), /Address: Hodan, near the mosque/);
  assert.equal(fixture.dispatches[0].orderType, "DELIVERY");
  assert.equal(fixture.dispatches[0].deliveryAddress, "Hodan, near the mosque");
  assert.equal(fixture.payments[0].payerPhone, "252901234567");
  assert.equal(fixture.payments[0].mobileMoneyReceiptId, "receipt-1");
  assert.equal(fixture.checkout.status, "PAID");
  assert.match(fixture.locks[0], /FOR UPDATE/);
  assert.equal(await fixture.finalize(), null);
  assert.equal(fixture.orders.length, 1);
  assert.equal(fixture.payments.length, 1);
  assert.deepEqual(fixture.sideEffects(), { tickets: 1, inventoryDeductions: 1 });
});

test("unverified or invalid deliveries do not create orders; paid invalid details require staff help", async () => {
  const unpaid = finalizationFixture();
  unpaid.checkout.status = "PENDING";
  assert.equal(await unpaid.finalize(), null);
  assert.equal(unpaid.orders.length, 0);
  const invalid = finalizationFixture();
  invalid.checkout.deliveryAddress = null;
  assert.equal(await invalid.finalize(), null);
  assert.equal(invalid.orders.length, 0);
  assert.equal(invalid.checkout.status, "NEEDS_HELP");
  const wrongAmount = finalizationFixture();
  wrongAmount.receipt.amount = 5;
  assert.equal(await wrongAmount.finalize(), null);
  assert.equal(wrongAmount.orders.length, 0);
});

test("dine-in and pickup finalization retain their existing destinations", async () => {
  for (const orderType of ["DINE_IN", "TAKEOUT"] as const) {
    const fixture = finalizationFixture(orderType);
    const order = await fixture.finalize();
    assert.equal(order?.type, orderType);
    assert.equal(order?.tableId, orderType === "DINE_IN" ? "table-1" : null);
    assert.equal(order?.deliveryAddress, null);
    assert.equal(order?.deliveryPhone, null);
    assert.match(String(order?.notes), orderType === "DINE_IN" ? /Dine in/ : /To go/);
  }
});

test("previously created dine-in and pickup checkouts can settle with saved longer names", async () => {
  for (const orderType of ["DINE_IN", "TAKEOUT"] as const) {
    const fixture = finalizationFixture(orderType);
    fixture.checkout.customerName = "A".repeat(101);
    const order = await fixture.finalize();
    assert.equal(order?.type, orderType);
    assert.equal(fixture.checkout.status, "PAID");
    assert.equal(fixture.payments.length, 1);
  }
});

test("customer checkout status and staff fulfillment expose the saved delivery destination/contact", async () => {
  const row = {
    id: "checkout-1", amount: 4, payerPhone: "252901234567", status: "PENDING",
    expiresAt: new Date(), receiptId: null, order: null, orderType: "DELIVERY",
    table: null, deliveryPhone: "+252 (61) 234-5678", deliveryAddress: "Hodan, near the mosque",
  };
  const customerRoute = loadModule("src/app/api/customer/checkouts/[id]/route.ts", {
    "next/server": nextResponseDependency,
    "@/lib/auth/api-authorization": authDependency,
    "@/lib/auth/permissions": { PERMISSIONS: {} },
    "@/lib/prisma": { prisma: { customerCheckout: { findFirst: async () => row } } },
    "@/lib/payments/customer-checkout": { expireCustomerCheckout: async () => {} },
    "@/lib/customer/customer-order-progress": { customerOrderStage: () => "PAYMENT" },
  });
  const response = await customerRoute.GET(undefined, { params: Promise.resolve({ id: row.id }) });
  assert.equal(response.body.checkout?.deliveryPhone, row.deliveryPhone);
  assert.equal(response.body.checkout?.deliveryAddress, row.deliveryAddress);
  const staffRoute = loadModule("src/app/api/staff/customer-fulfillment/route.ts", {
    "next/server": nextResponseDependency,
    "@/lib/auth/api-authorization": authDependency,
    "@/lib/auth/permissions": { PERMISSIONS: {} },
    "@/lib/customer/customer-order-fulfillment": fulfillmentDependency,
    "@/lib/customer/customer-order-progress": { customerOrderStage: () => "READY" },
    "@/lib/prisma": { prisma: { order: { findMany: async () => [{
      id: "order-1", orderNumber: 17, type: "DELIVERY", table: null,
      deliveryPhone: row.deliveryPhone, deliveryAddress: row.deliveryAddress,
      customerCheckout: { customerName: "Amina" }, kitchenTicketState: {},
    }] } } },
  });
  const staffResponse = await staffRoute.GET();
  assert.equal(staffResponse.body.orders?.[0].destination, "Delivery · Hodan, near the mosque");
  assert.equal(staffResponse.body.orders?.[0].deliveryPhone, row.deliveryPhone);
});
