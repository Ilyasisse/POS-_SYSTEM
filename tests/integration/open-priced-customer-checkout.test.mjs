import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { after } from "node:test";
import "tsx";

const state = {
  product: {
    id: "item", name: "Item", price: 5, isOpenPrice: false,
    cost: null, recipeVersions: [], category: { station: null },
  },
  checkout: null,
  receipt: null,
  orders: [],
  items: [],
  payments: [],
};
globalThis.__openPriceCheckoutRegression = state;
const sources = {
  "mock:open-price-auth": 'exports.authorizeApi = async () => ({ok:true,user:{id:"customer-1",role:"CUSTOMER",fullName:"Customer"}});',
  "mock:open-price-prisma": `const state = globalThis.__openPriceCheckoutRegression;
const tx = {
 $queryRaw: async () => [],
 customerCheckout: {
  findUnique: async () => state.checkout,
  create: async ({data}) => (state.checkout = {id:"checkout-1",status:"PENDING",...data}),
  update: async ({data}) => Object.assign(state.checkout,data),
  updateMany: async () => ({count:0}),
 },
 mobileMoneyReceipt: { findUnique: async () => state.receipt },
 product: { findMany: async () => [state.product] },
 order: { create: async ({data}) => { state.orders.push(data); return {id:"order-1",orderNumber:1,...data}; } },
 orderItem: { createMany: async ({data}) => { state.items.push(...data); return {count:data.length}; } },
 payment: { create: async ({data}) => { state.payments.push(data); return {id:"payment-1",...data}; } },
};
exports.prisma = { ...tx, $transaction: async (operation) => operation(tx) };`,
  "mock:open-price-kitchen": 'exports.createKitchenTicketState = async () => {};',
  "mock:open-price-inventory": 'exports.deductProductInventoryForSale = async () => []; exports.sendInventoryAlerts = async () => {};',
  "mock:open-price-dispatch": 'exports.dispatchCustomerOrder = async () => {};',
  "mock:open-price-analytics": 'exports.getPostHogClient = () => null;',
};
const modules = {
  "@/lib/auth/api-authorization": "mock:open-price-auth",
  "@/lib/prisma": "mock:open-price-prisma",
  "@/lib/kitchen/kitchen-tickets": "mock:open-price-kitchen",
  "@/lib/inventory/inventory": "mock:open-price-inventory",
  "@/lib/staff/customer-order-dispatch": "mock:open-price-dispatch",
  "@/lib/posthog-server": "mock:open-price-analytics",
};
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (Object.hasOwn(modules, specifier)) {
      return { url: modules[specifier], shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (Object.hasOwn(sources, url)) {
      return { format: "commonjs", source: sources[url], shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
after(() => {
  hooks.deregister();
  delete globalThis.__openPriceCheckoutRegression;
});
const { POST } = await import(new URL("../../src/app/api/customer/checkouts/route.ts", import.meta.url).href);
const { finalizeCustomerCheckout } = await import(new URL("../../src/lib/payments/customer-checkout.ts", import.meta.url).href);

async function createCheckout() {
  state.checkout = null;
  state.orders.length = 0;
  state.items.length = 0;
  state.payments.length = 0;
  return POST(new Request("http://localhost/api/customer/checkouts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      paymentPhone: "901234567",
      idempotencyKey: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      orderType: "TAKEOUT",
      items: [{ productId: "item", qty: 2, unitPriceOverride: 0.01 }],
    }),
  }));
}

test("verified customer checkout rejects a cashier-priced product", async () => {
  state.product.isOpenPrice = true;
  const response = await createCheckout();
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /must be priced by a cashier/);
  assert.equal(state.checkout, null);
});

test("customer price overrides cannot change a fixed product checkout", async () => {
  state.product.isOpenPrice = false;
  state.product.price = 5;
  const response = await createCheckout();
  assert.equal(response.status, 201);
  assert.equal(Number(state.checkout.amount), 10);
  assert.equal(state.checkout.snapshot[0].unitPrice, 5);
});

test("verified finalization preserves the server price agreed before a catalog change", async () => {
  state.product.isOpenPrice = false;
  state.product.price = 5;
  assert.equal((await createCheckout()).status, 201);
  state.checkout.status = "PAYMENT_RECEIVED";
  state.checkout.receiptId = "receipt-1";
  state.receipt = {
    id: "receipt-1", status: "ASSIGNED", amount: 10,
    providerReference: "reference-1", assignedByUserId: null,
    assignedByName: "Automatic", transactionAt: null,
  };
  state.product.price = 50;
  state.product.isOpenPrice = true;
  const order = await finalizeCustomerCheckout("checkout-1");
  assert.ok(order);
  assert.equal(state.checkout.status, "PAID");
  assert.equal(Number(state.orders[0].total), 10);
  assert.equal(Number(state.items[0].unitPrice), 5);
  assert.equal(Number(state.payments[0].amountPaid), 10);
});
