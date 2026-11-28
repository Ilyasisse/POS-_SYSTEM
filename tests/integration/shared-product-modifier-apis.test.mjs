import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { after, beforeEach } from "node:test";
import "tsx";

const state = {
  products: [],
  modifiers: [],
  writes: [],
  lastOrder: null,
  findProducts(args) {
    const relation = args.select?.modifiers ?? args.include?.modifiers;
    assert.ok(relation, "product queries must read the direct modifiers relation");
    return this.products
      .filter((product) => !args.where.id || args.where.id.in.includes(product.id))
      .map(({ modifierIds, ...product }) => ({
        ...product,
        modifiers: modifierIds
          .map((id) => this.modifiers.find((modifier) => modifier.id === id))
          .filter(
            (modifier) =>
              modifier &&
              (!relation.where?.isActive || modifier.isActive) &&
              (!relation.where?.modifierGroup?.isActive || modifier.modifierGroup.isActive),
          ),
      }));
  },
  findModifiers({ where }) {
    return this.modifiers.filter(
      (modifier) =>
        where.id.in.includes(modifier.id) &&
        (!where.isActive || modifier.isActive) &&
        (!where.modifierGroup?.isActive || modifier.modifierGroup.isActive),
    );
  },
};
globalThis.__sharedModifierApis = state;

const sources = {
  "mock:shared-modifier-prisma": `
    const state = globalThis.__sharedModifierApis;
    const record = (model, data) => { state.writes.push({model, data}); return data; };
    const tx = {
      $queryRaw: async () => [],
      order: {
        findFirst: async () => null,
        create: async ({data}) => {
          record("order", data);
          return state.lastOrder = {
            id:"order-1", orderNumber:1, createdAt:new Date("2026-11-25T08:00:00Z"), ...data,
          };
        },
        update: async ({data}) => state.lastOrder = {
          ...state.lastOrder, ...data, tableCheck:{checkNumber:1},
        },
        aggregate: async () => ({_sum:{total:state.lastOrder.total}}),
      },
      tableCheck: {create: async () => ({id:"check-1"})},
      orderItem: {createMany: async ({data}) => record("orderItem", data)},
      orderItemModifier: {createMany: async ({data}) => record("orderItemModifier", data)},
      payment: {create: async ({data}) => record("payment", data)},
    };
    exports.prisma = {
      product: {findMany: async args => state.findProducts(args)},
      modifier: {findMany: async args => state.findModifiers(args)},
      staff: {
        findUnique: async () => ({id:"cashier-1",fullName:"Cashier",role:"CASHIER",isActive:true}),
        findMany: async () => [],
      },
      table: {findFirst: async () => ({id:"table-1",name:"Table 1"})},
      customerCheckout: {
        findUnique: async () => null,
        create: async ({data}) => ({id:"checkout-1",status:"PENDING",...record("checkout",data)}),
      },
      $transaction: async callback => callback(tx),
    };
  `,
  "mock:shared-modifier-auth": `
    exports.createClient = async () => ({
      auth:{getUser:async () => ({data:{user:{id:"cashier-1"}}})},
    });
  `,
  "mock:shared-modifier-customer": `
    exports.authorizeApi = async () => ({
      ok:true,user:{id:"customer-1",role:"CUSTOMER",fullName:"Customer"},
    });
  `,
  "mock:shared-modifier-inventory": `
    exports.deductProductInventoryForSale = async () => [];
    exports.sendInventoryAlerts = async () => {};
  `,
  "mock:shared-modifier-kitchen": "exports.createKitchenTicketState = async () => {};",
  "mock:shared-modifier-posthog": "exports.getPostHogClient = () => null;",
  "mock:shared-modifier-shifts": "exports.getActiveWaiterOrderingShift = async () => null;",
};
const aliases = {
  "@/lib/prisma": "mock:shared-modifier-prisma",
  "@/lib/supabase/server": "mock:shared-modifier-auth",
  "@/lib/auth/api-authorization": "mock:shared-modifier-customer",
  "@/lib/inventory/inventory": "mock:shared-modifier-inventory",
  "@/lib/kitchen/kitchen-tickets": "mock:shared-modifier-kitchen",
  "@/lib/posthog-server": "mock:shared-modifier-posthog",
  "@/lib/waiter/waiter-shifts": "mock:shared-modifier-shifts",
};
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    return aliases[specifier]
      ? { url: aliases[specifier], shortCircuit: true }
      : nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    return Object.hasOwn(sources, url)
      ? { format: "commonjs", source: sources[url], shortCircuit: true }
      : nextLoad(url, context);
  },
});
after(() => {
  hooks.deregister();
  delete globalThis.__sharedModifierApis;
});
beforeEach(() => {
  const group = {
    id: "extras",
    name: "Extras",
    isRequired: false,
    minSelect: 0,
    maxSelect: 1,
    isActive: true,
  };
  state.modifiers = [
    { id: "milk", name: "Milk", price: 2, isActive: true, modifierGroup: { ...group } },
    { id: "sugar", name: "Sugar", price: 1, isActive: true, modifierGroup: { ...group } },
    { id: "inactive", name: "Inactive", price: 3, isActive: false, modifierGroup: { ...group } },
    {
      id: "hidden",
      name: "Hidden group",
      price: 4,
      isActive: true,
      modifierGroup: { ...group, id: "hidden-group", isActive: false },
    },
  ];
  state.products = ["coffee", "tea"].map((id) => ({
    id,
    name: id,
    price: 5,
    cost: null,
    isActive: true,
    isPopular: true,
    availableForSale: true,
    availabilityRestoresAt: null,
    recipeVersions: [],
    category: { id: "drinks", name: "Drinks", station: null },
    modifierIds: ["milk", "sugar", "inactive", "hidden"],
  }));
  state.writes.length = 0;
  state.lastOrder = null;
});

async function handler(path, method) {
  const mod = await import(
    new URL("../../src/app/api/" + path + "/route.ts", import.meta.url).href
  );
  return mod[method] ?? mod.default?.[method];
}
const routes = [
  ["orders", await handler("orders", "POST")],
  ["complete sale", await handler("orders/complete-sale", "POST")],
  ["table order", await handler("orders/table", "POST")],
  ["customer checkout", await handler("customer/checkouts", "POST")],
];
const feeds = [
  ["popular products", await handler("GET/Product", "GET")],
  ["all products", await handler("GET/Product/all", "GET")],
];
async function submit(post, selectedIds = ["milk"]) {
  return post(
    new Request("http://localhost/api/order", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        paymentMethod: "OTHER",
        orderType: "TAKEOUT",
        tableId: "table-1",
        paymentPhone: "901234567",
        idempotencyKey: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        items: state.products.map((product) => ({
          productId: product.id,
          qty: 1,
          modifiers: selectedIds.map((modifierId) => ({ modifierId })),
        })),
      }),
    }),
  );
}
for (const [name, post] of routes) {
  test(
    name + ": one modifier works for both assigned products and uses the shared price",
    async () => {
      state.modifiers[0].price = 3;
      const response = await submit(post);
      assert.ok(response.ok, JSON.stringify(await response.clone().json()));
      const body = await response.json();
      const total = body.checkout?.amount ?? body.receipt?.total ?? body.order.total;
      assert.equal(Number(total), 16);
      const checkout = state.writes.find((write) => write.model === "checkout");
      const snapshots = checkout
        ? checkout.data.snapshot.flatMap((line) => line.modifiers)
        : state.writes.find((write) => write.model === "orderItemModifier").data;
      assert.equal(snapshots.length, 2);
      assert.ok(snapshots.every((modifier) => Number(modifier.price) === 3));
    },
  );

  test(name + ": removing one assignment rejects that product without saving", async () => {
    state.products[1].modifierIds = ["sugar"];
    const response = await submit(post);
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /invalid for product tea/);
    assert.equal(state.writes.length, 0);
  });

  for (const modifierId of ["inactive", "hidden", "missing"]) {
    test(name + ": rejects " + modifierId + " modifier without saving", async () => {
      const response = await submit(post, [modifierId]);
      assert.equal(response.status, 400);
      assert.equal(state.writes.length, 0);
    });
  }

  test(name + ": required group and maximum selection limits remain enforced", async () => {
    state.modifiers[0].modifierGroup.isRequired = true;
    let response = await submit(post, []);
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /requires at least 1 choice/);
    response = await submit(post, ["milk", "sugar"]);
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /allows at most 1 choice/);
    assert.equal(state.writes.length, 0);
  });
}

for (const [name, get] of feeds) {
  test(name + ": returns direct modifiers and excludes inactive options and groups", async () => {
    const response = await get();
    assert.equal(response.status, 200);
    const products = await response.json();
    assert.equal(products.length, 2);
    for (const product of products) {
      assert.deepEqual(
        product.modifiers.map((modifier) => modifier.id),
        ["milk", "sugar"],
      );
      assert.deepEqual(
        product.modifierGroups.map((group) => group.id),
        ["extras"],
      );
      assert.deepEqual(
        product.modifierGroups[0].options.map((option) => option.id),
        ["milk", "sugar"],
      );
      assert.equal("modifierLinks" in product, false);
    }
  });
}
