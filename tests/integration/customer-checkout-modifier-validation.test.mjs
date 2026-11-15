import { expect, afterAll, jest, test } from "@jest/globals";

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
jest.unstable_mockModule("@/lib/auth/api-authorization", () => ({
  authorizeApi: async () => ({
    ok: true,
    user: { id: "customer-1", role: "CUSTOMER", fullName: "Customer" },
  }),
}));
jest.unstable_mockModule("@/lib/prisma", () => {
  const state = globalThis.__checkoutRegression;
  return {
    prisma: {
      product: { findMany: async () => [state.product] },
      modifier: { findMany: async () => [state.modifier] },
      staff: { findMany: async () => [] },
      table: { findFirst: async () => ({ id: "table-1" }) },
      customerCheckout: {
        findUnique: async () => null,
        create: async ({ data }) => {
          state.writes.push(data);
          return { id: "checkout-1", amount: data.amount, status: "PENDING" };
        },
      },
    },
  };
});
afterAll(() => {
  jest.unstable_unmockModule("@/lib/auth/api-authorization");
  jest.unstable_unmockModule("@/lib/prisma");
  delete globalThis.__checkoutRegression;
});
const { POST } = await import("../../src/app/api/customer/checkouts/route.ts");
expect({ context: "Checkout route must export POST", value: typeof POST }).toStrictEqual({
  context: "Checkout route must export POST",
  value: "function",
});
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
  expect(response.status).toBe(201);
  const [write] = globalThis.__checkoutRegression.writes;
  expect(write.orderType).toBe("DINE_IN");
  expect(write.tableId).toBe("table-1");
  expect(Number(write.amount)).toBe(7);
});
test("spoofed placeholder with catalog ID cannot satisfy a required group", async () => {
  const response = await checkout([{ modifierId: "large", isPlaceholder: true, price: 0 }]);
  expect(response.status).toBe(400);
  expect((await response.json()).error).toMatch(/requires at least 1 choice from Size/);
  expect(globalThis.__checkoutRegression.writes.length).toBe(0);
});
test("missing required modifier creates no checkout", async () => {
  const response = await checkout([]);
  expect(response.status).toBe(400);
  expect((await response.json()).error).toMatch(/requires at least 1 choice from Size/);
  expect(globalThis.__checkoutRegression.writes.length).toBe(0);
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
  expect(response.status).toBe(201);
  expect(Number(globalThis.__checkoutRegression.writes[0].amount)).toBe(8);
});
test("main local payment phone validation remains in effect", async () => {
  const response = await checkout([{ modifierId: "large" }], {
    paymentPhone: "+252901234567",
  });
  expect(response.status).toBe(400);
  expect(globalThis.__checkoutRegression.writes.length).toBe(0);
});
