import assert from "node:assert/strict";
import test from "node:test";
import type { CartLine, Product, StaffSummary } from "@/lib/types";
import { customerReturnPath } from "@/lib/auth/customer-return-path";
import {
  clearCustomerOrderDraft,
  saveCustomerFulfillment,
  restoreCustomerFulfillment,
  restoreCustomerOrderDraft,
  saveCustomerOrderDraft,
} from "@/lib/customer/customer-order-draft";

const storage = new Map<string, string>();
Object.defineProperty(globalThis, "sessionStorage", {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
  },
  configurable: true,
});

const product: Product = {
  id: "latte",
  name: "Latte",
  price: 5,
  isPopular: false,
  category: { id: "coffee", name: "Coffee", station: "BARISTA" },
  modifierGroups: [
    {
      id: "milk",
      name: "Milk",
      required: true,
      minSelect: 1,
      maxSelect: 1,
      multiple: false,
      options: [{ id: "oat", name: "Oat", price: 1 }],
    },
  ],
};
const baristas: StaffSummary[] = [{ id: "b1", fullName: "Barista One" }];
const cart: CartLine[] = [
  {
    cartKey: "latte__BARISTA__b1__oat:1",
    id: "latte",
    name: "Latte",
    product,
    price: 5,
    finalPrice: 6,
    quantity: 2,
    selectedModifiers: [
      {
        groupId: "milk",
        groupName: "Milk",
        optionId: "oat",
        optionName: "Oat",
        price: 1,
        qty: 1,
      },
    ],
    station: "BARISTA",
    assignedUserId: "b1",
    assignedUserName: "Barista One",
  },
];

test("OAuth return accepts only the customer order route", () => {
  assert.equal(customerReturnPath("/customer"), "/customer");
  for (const value of [
    "//example.com",
    "/customer/../admin",
    "/admin",
    "https://example.com",
    null,
  ]) {
    assert.equal(customerReturnPath(value), null);
  }
});

test("draft restores configured items and customer fields", () => {
  storage.clear();
  assert.equal(saveCustomerOrderDraft(cart, "Alex", "123", "Less sugar"), true);
  const restored = restoreCustomerOrderDraft([product], baristas);
  assert.ok(restored);
  assert.equal(restored.cart.length, 1);
  assert.equal(restored.cart[0].quantity, 2);
  assert.equal(restored.cart[0].assignedUserId, "b1");
  assert.equal(restored.cart[0].selectedModifiers[0].optionId, "oat");
  assert.equal(restored.customerName, "Alex");
  assert.equal(restored.customerPhone, "123");
  assert.equal(restored.orderNote, "Less sugar");
  assert.equal(restored.skipped, 0);
  assert.equal(restored.repriced, 0);
});

test("draft flags changed prices and drops unavailable choices", () => {
  storage.clear();
  saveCustomerOrderDraft(cart, "Alex", "", "");
  const repriced = restoreCustomerOrderDraft(
    [{ ...product, price: 7 }],
    baristas,
  );
  assert.ok(repriced);
  assert.equal(repriced.cart[0].finalPrice, 8);
  assert.equal(repriced.repriced, 1);

  const missingBarista = restoreCustomerOrderDraft([product], []);
  assert.ok(missingBarista);
  assert.equal(missingBarista.cart.length, 0);
  assert.equal(missingBarista.skipped, 1);

  const missingModifier = restoreCustomerOrderDraft(
    [{ ...product, modifierGroups: [] }],
    baristas,
  );
  assert.ok(missingModifier);
  assert.equal(missingModifier.skipped, 1);
  clearCustomerOrderDraft();
  assert.equal(restoreCustomerOrderDraft([product], baristas), null);
});

test("dine-in selection survives OAuth navigation and is cleared with the cart", () => {
  storage.clear();
  saveCustomerFulfillment("DINE_IN", "table-one");
  assert.deepEqual(restoreCustomerFulfillment(), { orderType: "DINE_IN", tableId: "table-one", deliveryAddress: "", deliveryPhone: "" });
  clearCustomerOrderDraft();
  assert.equal(restoreCustomerFulfillment(), null);
  storage.set("customer-fulfillment-v1", '{"orderType":"COURIER","tableId":"table-one"}');
  assert.equal(restoreCustomerFulfillment(), null);
});

test("delivery destination survives OAuth separately from the payment phone", () => {
  storage.clear();
  assert.equal(saveCustomerOrderDraft(cart, "Amina", "901234567", "Call on arrival"), true);
  assert.equal(saveCustomerFulfillment("DELIVERY", "stale-table", "Hodan, near the mosque", "+252 61 2345678"), true);
  assert.deepEqual(restoreCustomerFulfillment(), {
    orderType: "DELIVERY",
    tableId: "",
    deliveryAddress: "Hodan, near the mosque",
    deliveryPhone: "+252 61 2345678",
  });
  const restored = restoreCustomerOrderDraft([product], baristas);
  assert.equal(restored?.customerPhone, "901234567");
  assert.equal(restored?.orderNote, "Call on arrival");
  clearCustomerOrderDraft();
  assert.equal(restoreCustomerFulfillment(), null);
});

test("pickup drops stale delivery details and older dine-in drafts still restore", () => {
  storage.clear();
  saveCustomerFulfillment("TAKEOUT", "stale-table", "Old delivery address", "0612345678");
  assert.deepEqual(restoreCustomerFulfillment(), { orderType: "TAKEOUT", tableId: "", deliveryAddress: "", deliveryPhone: "" });
  storage.set("customer-fulfillment-v1", '{"orderType":"DINE_IN","tableId":"table-one"}');
  assert.deepEqual(restoreCustomerFulfillment(), { orderType: "DINE_IN", tableId: "table-one", deliveryAddress: "", deliveryPhone: "" });
});

test("delivery draft rejects malformed contact data", () => {
  for (const deliveryPhone of [42, "x".repeat(31)]) {
    storage.set("customer-fulfillment-v1", JSON.stringify({ orderType: "DELIVERY", tableId: "", deliveryAddress: "Hodan near the mosque", deliveryPhone }));
    assert.equal(restoreCustomerFulfillment(), null);
  }
});
