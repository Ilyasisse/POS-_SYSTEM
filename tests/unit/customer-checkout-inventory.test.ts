import assert from "node:assert/strict";
import Module from "node:module";
import test from "node:test";

const deductions: unknown[] = [];
const orderItems: unknown[] = [];
const tx = {
  $queryRaw: async () => [],
  customerCheckout: {
    findUnique: async () => ({
      status: "PAYMENT_RECEIVED",
      receiptId: "receipt-1",
      amount: 10,
      customerId: "customer-1",
      customerName: "Customer",
      payerPhone: "123",
      tableId: null,
      orderType: "TAKEAWAY",
      snapshot: ["old-recipe", null].map((recipeVersionId, index) => ({
        productId: `product-${index}`,
        productName: "Meal",
        qty: 1,
        station: null,
        modifiers: [],
        unitPrice: 5,
        lineTotal: 5,
        costSnapshot: {
          recipeVersionId,
          unitCostSnapshot: "1",
          costSnapshotSource: recipeVersionId
            ? "RECIPE_STANDARD"
            : "PRODUCT_STANDARD",
        },
      })),
    }),
    update: async () => undefined,
  },
  mobileMoneyReceipt: {
    findUnique: async () => ({
      status: "ASSIGNED",
      amount: 10,
      providerReference: "reference-1",
    }),
  },
  order: { create: async () => ({ id: "order-1", orderNumber: 1 }) },
  orderItem: {
    createMany: async ({ data }: { data: unknown[] }) => {
      orderItems.push(...data);
    },
  },
  payment: { create: async () => undefined },
};
const moduleLoader = Module as unknown as {
  _load: (id: string, ...args: unknown[]) => unknown;
};
const originalLoad = moduleLoader._load;
moduleLoader._load = function (id, ...args) {
  if (id === "@/lib/prisma")
    return {
      prisma: {
        $transaction: (callback: (value: unknown) => unknown) => callback(tx),
      },
    };
  if (id === "@/lib/kitchen/kitchen-tickets")
    return { createKitchenTicketState: async () => undefined };
  if (id === "@/lib/staff/customer-order-dispatch")
    return { dispatchCustomerOrder: async () => undefined };
  if (id === "@/lib/posthog-server") return { getPostHogClient: () => null };
  if (id === "@/lib/inventory/inventory")
    return {
      deductProductInventoryForSale: async (_tx: unknown, lines: unknown[]) => {
        deductions.push(...lines);
        return [];
      },
      sendInventoryAlerts: async () => undefined,
    };
  return originalLoad.call(this, id, ...args);
};
const checkout = import("../../src/lib/payments/customer-checkout").finally(
  () => {
    moduleLoader._load = originalLoad;
  },
);

test("paid checkout forwards its stored recipe and explicit no-recipe snapshot to inventory", async () => {
  const { finalizeCustomerCheckout } = await checkout;
  const order = await finalizeCustomerCheckout("checkout-1");
  assert.equal(order?.id, "order-1");
  assert.deepEqual(deductions, [
    { productId: "product-0", qty: 1, recipeVersionId: "old-recipe" },
    { productId: "product-1", qty: 1, recipeVersionId: null },
  ]);
  assert.deepEqual(
    orderItems.map(
      (item) => (item as { recipeVersionId: string | null }).recipeVersionId,
    ),
    ["old-recipe", null],
  );
});
