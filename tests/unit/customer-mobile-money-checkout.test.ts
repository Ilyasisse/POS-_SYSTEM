import assert from "node:assert/strict";
import test from "node:test";
import {
  androidDialerHref,
  chooseUniqueCustomerCheckout,
  customerUssdCode,
  formatCustomerUssdAmount,
  normalizeSomaliPhone,
} from "../../src/lib/payments/customer-ussd";

test("formats the exact cafe USSD code without decimals for whole amounts", () => {
  assert.equal(customerUssdCode(26), "*884*43095*26#");
  assert.equal(customerUssdCode(26.5), "*884*43095*26.50#");
  assert.equal(formatCustomerUssdAmount(0.75), "0.75");
  assert.equal(androidDialerHref("*884*43095*26#"), "tel:*884*43095*26%23");
});

test("normalizes Somali mobile numbers without accepting unrelated identifiers", () => {
  assert.equal(normalizeSomaliPhone("+252 90 510 9687"), "252905109687");
  assert.equal(normalizeSomaliPhone("0905109687"), "252905109687");
  assert.equal(normalizeSomaliPhone("905109687"), "252905109687");
  assert.equal(normalizeSomaliPhone("43095"), null);
  assert.equal(normalizeSomaliPhone("252905109687#"), null);
});

test("automatically selects only a unique exact receipt match in the payment window", () => {
  const now = new Date("2026-09-18T06:00:30Z");
  const createdAt = new Date("2026-09-18T06:00:00.800Z");
  const expiresAt = new Date("2026-09-18T06:15:00Z");
  const candidate = { id: "checkout-1", amount: 26, payerPhone: "252905109687", createdAt, expiresAt };
  const receipt = {
    amount: 26,
    identifiers: ["43095", "252905109687"],
    transactionAt: new Date("2026-09-18T06:00:00Z"),
  };
  assert.equal(chooseUniqueCustomerCheckout(receipt, [candidate], now), "checkout-1");
  assert.equal(chooseUniqueCustomerCheckout(receipt, [candidate, { ...candidate, id: "checkout-2" }], now), null);
  assert.equal(chooseUniqueCustomerCheckout({ ...receipt, identifiers: ["43095"] }, [candidate], now), null);
  assert.equal(chooseUniqueCustomerCheckout({ ...receipt, amount: 25 }, [candidate], now), null);
  assert.equal(chooseUniqueCustomerCheckout({ ...receipt, transactionAt: new Date("2026-09-18T05:59:58Z") }, [candidate], now), null);
  assert.equal(chooseUniqueCustomerCheckout(receipt, [candidate], new Date("2026-09-18T06:15:01Z")), null);
});
