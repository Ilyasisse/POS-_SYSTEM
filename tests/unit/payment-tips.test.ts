import assert from "node:assert/strict";
import test from "node:test";
import {
  allocateReceiptWithTip,
  paymentLineCents,
} from "../../src/lib/payments/payment-tip-math";

test("adds a tip to the exact expected transfer without changing the bill", () => {
  assert.deepEqual(paymentLineCents(10, 2.5), {
    billCents: 1000,
    tipCents: 250,
    expectedCents: 1250,
  });
});

test("rejects negative tips", () => {
  assert.throws(() => paymentLineCents(10, -0.01), /cannot be negative/);
});

test("allocates only the bill portion of a final receipt", () => {
  assert.deepEqual(
    allocateReceiptWithTip({
      billCents: 1000,
      billPaidCents: 600,
      expectedCents: 1200,
      receivedCents: 600,
      receiptCents: 600,
    }),
    {
      billAllocationCents: 400,
      totalReceivedCents: 1200,
      remainingExpectedCents: 0,
      fullyMatched: true,
    },
  );
});

test("rejects a receipt larger than bill plus tip remaining", () => {
  assert.throws(
    () =>
      allocateReceiptWithTip({
        billCents: 1000,
        billPaidCents: 0,
        expectedCents: 1200,
        receivedCents: 0,
        receiptCents: 1201,
      }),
    /exceeds/,
  );
});
