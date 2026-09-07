import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildCustomerOrderNote,
  validateCustomerFulfillment,
} from "../../src/lib/customer/customer-order-fulfillment";

test("pickup remains the default and discards an unused address", () => {
  const result = validateCustomerFulfillment({
    customerName: "Amina",
    deliveryAddress: "Not used",
  });

  assert.deepEqual(result, {
    ok: true,
    value: {
      fulfillmentType: "TAKEOUT",
      customerName: "Amina",
      customerPhone: "",
      deliveryAddress: null,
      notes: "",
    },
  });
});

test("delivery requires a usable phone number and address", () => {
  assert.deepEqual(
    validateCustomerFulfillment({
      fulfillmentType: "COURIER",
      customerName: "Amina",
    }),
    { ok: false, error: "Select pickup or delivery." },
  );

  assert.deepEqual(
    validateCustomerFulfillment({
      fulfillmentType: "DELIVERY",
      customerName: "Amina",
      customerPhone: "12",
      deliveryAddress: "Maka Al-Mukarama Road",
    }),
    { ok: false, error: "A phone number is required for delivery." },
  );

  assert.deepEqual(
    validateCustomerFulfillment({
      fulfillmentType: "DELIVERY",
      customerName: "Amina",
      customerPhone: "0612345678",
      deliveryAddress: "Road",
    }),
    {
      ok: false,
      error: "Enter a delivery address between 5 and 500 characters.",
    },
  );
});

test("delivery details are normalized and represented on the kitchen note", () => {
  const result = validateCustomerFulfillment({
    fulfillmentType: "DELIVERY",
    customerName: "  Amina  ",
    customerPhone: " 0612345678 ",
    deliveryAddress: "  Hodan, near the mosque  ",
    notes: "  Call on arrival  ",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.value.deliveryAddress, "Hodan, near the mosque");
  assert.match(buildCustomerOrderNote(result.value), /Fulfillment: Delivery/);
  assert.match(buildCustomerOrderNote(result.value), /Call on arrival/);
});

test("the order route persists structured delivery data", async () => {
  const route = await readFile(
    new URL("../../src/app/api/customer/orders/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /type: fulfillmentType/);
  assert.match(route, /deliveryAddress,/);
  assert.match(route, /deliveryPhone:/);
});
