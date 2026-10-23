import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { after } from "node:test";
import "tsx";

const group = {
  id: "size",
  name: "Size",
  isRequired: true,
  minSelect: 1,
  maxSelect: 1,
  isActive: true,
};
const modifier = {
  id: "large",
  name: "Large",
  price: 2,
  productId: "coffee",
  isActive: true,
  modifierGroup: group,
};
globalThis.__checkoutRegression = {
  writes: [],
  product: {
    id: "coffee",
    name: "Coffee",
    price: 5,
    cost: null,
    recipeVersions: [],
    modifiers: [modifier],
    category: { station: null },
  },
  modifier,
};
const sources = {
  "mock:checkout-auth":
    'exports.authorizeApi = async () => ({ok:true,user:{id:"customer-1",role:"CUSTOMER",fullName:"Customer"}});',
  "mock:checkout-prisma": `const state = globalThis.__checkoutRegression;
exports.prisma = {
 product: { findMany: async () => [state.product] },
 modifier: { findMany: async () => [state.modifier] },
 staff: { findMany: async () => [] },
 table: { findFirst: async () => ({id:"table-1"}) },
 customerCheckout: { findUnique: async () => null, create: async ({data}) => { state.writes.push(data); return {id:"checkout-1",amount:data.amount,status:"PENDING"}; } },
};`,
};
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/auth/api-authorization")
      return { url: "mock:checkout-auth", shortCircuit: true };
    if (specifier === "@/lib/prisma")
      return { url: "mock:checkout-prisma", shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (Object.hasOwn(sources, url))
      return { format: "commonjs", source: sources[url], shortCircuit: true };
    return nextLoad(url, context);
  },
});
after(() => {
  hooks.deregister();
  delete globalThis.__checkoutRegression;
});
const { POST } = await import(
  new URL("../../src/app/api/customer/checkouts/route.ts", import.meta.url).href
);
const base = {
  customerName: "Customer",
  paymentPhone: "901234567",
  idempotencyKey: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  orderType: "DINE_IN",
  tableId: "table-1",
};
async function checkout(modifiers, extra = {}) {
  globalThis.__checkoutRegression.writes.length = 0;
  return POST(
    new Request("http://localhost/api/customer/checkouts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...base,
        ...extra,
        items: [{ productId: "coffee", qty: 1, modifiers }],
      }),
    }),
  );
}

test("valid catalog modifiers create checkout while preserving main fulfillment", async () => {
  const response = await checkout([{ modifierId: "large", qty: 1 }]);
  assert.equal(response.status, 201);
  const [write] = globalThis.__checkoutRegression.writes;
  assert.equal(write.orderType, "DINE_IN");
  assert.equal(write.tableId, "table-1");
  assert.equal(Number(write.amount), 7);
});
test("spoofed placeholder with catalog ID cannot satisfy a required group", async () => {
  const response = await checkout([
    { modifierId: "large", isPlaceholder: true, price: 0 },
  ]);
  assert.notEqual(response.status, 201);
  assert.match(
    (await response.json()).error,
    /requires at least 1 choice from Size/,
  );
  assert.equal(globalThis.__checkoutRegression.writes.length, 0);
});
test("missing required modifier creates no checkout", async () => {
  const response = await checkout([]);
  assert.notEqual(response.status, 201);
  assert.match(
    (await response.json()).error,
    /requires at least 1 choice from Size/,
  );
  assert.equal(globalThis.__checkoutRegression.writes.length, 0);
});
test("real required choice and custom placeholder remain supported", async () => {
  const response = await checkout([
    { modifierId: "large" },
    {
      modifierId: "placeholder__custom",
      isPlaceholder: true,
      price: 1,
      modifierName: "Extra",
      groupName: "Custom",
    },
  ]);
  assert.equal(response.status, 201);
  assert.equal(Number(globalThis.__checkoutRegression.writes[0].amount), 8);
});
test("main local payment phone validation remains in effect", async () => {
  const response = await checkout([{ modifierId: "large" }], {
    paymentPhone: "+252901234567",
  });
  assert.equal(response.status, 400);
  assert.equal(globalThis.__checkoutRegression.writes.length, 0);
});
