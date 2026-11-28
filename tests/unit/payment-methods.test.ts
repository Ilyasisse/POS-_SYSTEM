import assert from "node:assert/strict";
import test from "node:test";

import {
  isPosPaymentMethod,
  isReceiptMatchPaymentMethod,
  POS_PAYMENT_METHODS,
  remainingPaymentAmount,
} from "../../src/lib/payments/payment-methods";

test("physical cash is a supported POS payment method", () => {
  assert.equal(POS_PAYMENT_METHODS[0], "CASH");
  assert.equal(isPosPaymentMethod("CASH"), true);
});

test("cash settlement records only the remaining order balance", () => {
  assert.equal(remainingPaymentAmount(12.5, [4, 2.25]), 6.25);
  assert.equal(remainingPaymentAmount(10, [10]), 0);
  assert.equal(remainingPaymentAmount(0.3, [0.1, 0.2]), 0);
});

test("cash does not enter the mobile receipt-matching workflow", () => {
  assert.equal(isReceiptMatchPaymentMethod("CASH"), false);
  assert.equal(isReceiptMatchPaymentMethod("GOLIS"), true);
  assert.equal(isPosPaymentMethod("unknown"), false);
});
