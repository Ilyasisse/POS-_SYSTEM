import { expect, test } from "@jest/globals";

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

test("OAuth return accepts only the customer menu and history routes", () => {
  expect(customerReturnPath("/customer")).toBe("/customer");
  expect(customerReturnPath("/customer/orders")).toBe("/customer/orders");
  for (const value of [
    "//example.com",
    "/customer/../admin",
    "/customer/orders/../admin",
    "/customer/orders?next=https://example.com",
    "/customer/orders/",
    "/admin",
    "https://example.com",
    null,
  ]) {
    expect(customerReturnPath(value)).toBe(null);
  }
});

test("draft restores configured items and customer fields", () => {
  storage.clear();
  expect(saveCustomerOrderDraft(cart, "Alex", "123", "Less sugar")).toBe(true);
  const restored = restoreCustomerOrderDraft([product], baristas);
  expect(restored).toBeTruthy();
  if (!restored) throw new Error("Expected restored to be present");
  expect(restored.cart.length).toBe(1);
  expect(restored.cart[0].quantity).toBe(2);
  expect(restored.cart[0].assignedUserId).toBe("b1");
  expect(restored.cart[0].selectedModifiers[0].optionId).toBe("oat");
  expect(restored.customerName).toBe("Alex");
  expect(restored.customerPhone).toBe("123");
  expect(restored.orderNote).toBe("Less sugar");
  expect(restored.skipped).toBe(0);
  expect(restored.repriced).toBe(0);
});

test("draft flags changed prices and drops unavailable choices", () => {
  storage.clear();
  saveCustomerOrderDraft(cart, "Alex", "", "");
  const repriced = restoreCustomerOrderDraft([{ ...product, price: 7 }], baristas);
  expect(repriced).toBeTruthy();
  if (!repriced) throw new Error("Expected repriced to be present");
  expect(repriced.cart[0].finalPrice).toBe(8);
  expect(repriced.repriced).toBe(1);

  const missingBarista = restoreCustomerOrderDraft([product], []);
  expect(missingBarista).toBeTruthy();
  if (!missingBarista) throw new Error("Expected missingBarista to be present");
  expect(missingBarista.cart.length).toBe(0);
  expect(missingBarista.skipped).toBe(1);

  const missingModifier = restoreCustomerOrderDraft([{ ...product, modifierGroups: [] }], baristas);
  expect(missingModifier).toBeTruthy();
  if (!missingModifier) throw new Error("Expected missingModifier to be present");
  expect(missingModifier.skipped).toBe(1);
  clearCustomerOrderDraft();
  expect(restoreCustomerOrderDraft([product], baristas)).toBe(null);
});

test("dine-in selection survives OAuth navigation and is cleared with the cart", () => {
  storage.clear();
  saveCustomerFulfillment("DINE_IN", "table-one");
  expect(restoreCustomerFulfillment()).toStrictEqual({
    orderType: "DINE_IN",
    tableId: "table-one",
  });
  clearCustomerOrderDraft();
  expect(restoreCustomerFulfillment()).toBe(null);
  storage.set("customer-fulfillment-v1", '{"orderType":"DELIVERY","tableId":"table-one"}');
  expect(restoreCustomerFulfillment()).toBe(null);
});
