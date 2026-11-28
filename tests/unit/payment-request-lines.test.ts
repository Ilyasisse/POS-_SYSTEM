import assert from "node:assert/strict";
import test from "node:test";
import { preparePaymentRequestLines } from "../../src/lib/payments/payment-request-lines";

test("keeps an independent payment method for every payer", () => {
  const lines = preparePaymentRequestLines([
    { payerName: "Amina", payerPhone: "090000001", amount: 5, method: "GOLIS" },
    {
      payerName: "Hassan",
      payerPhone: "090000002",
      amount: 7.5,
      method: "MYCASH",
    },
  ]);

  assert.deepEqual(
    lines.map((line) => [line.method, line.amountCents]),
    [
      ["GOLIS", 500],
      ["MYCASH", 750],
    ],
  );
});

test("supports the previous batch-level method as a fallback", () => {
  const lines = preparePaymentRequestLines(
    [
      { payerName: "Amina", payerPhone: "090000001", amount: 4 },
      { payerName: "Hassan", payerPhone: "090000002", amount: 3, method: "" },
      { payerName: "Ali", payerPhone: "090000003", amount: 2, method: "GOLIS" },
    ],
    "Dahabshiil",
  );
  assert.deepEqual(
    lines.map((line) => line.method),
    ["Dahabshiil", "Dahabshiil", "GOLIS"],
  );
});

test("rejects an invalid explicit method even with a batch fallback", () => {
  assert.throws(
    () =>
      preparePaymentRequestLines(
        [
          {
            payerName: "Amina",
            payerPhone: "090000001",
            amount: 5,
            method: "BOGUS",
          },
        ],
        "GOLIS",
      ),
    /method, name, phone number, and amount/,
  );
});

test("requires complete payer and payment details", () => {
  assert.throws(
    () =>
      preparePaymentRequestLines([
        { payerName: "Amina", payerPhone: "090000001", amount: 5 },
      ]),
    /method, name, phone number, and amount/,
  );
  assert.throws(() => preparePaymentRequestLines([]), /at least one payer/);
  assert.throws(
    () =>
      preparePaymentRequestLines([
        {
          payerName: "Amina",
          payerPhone: "090000001",
          amount: Number.NaN,
          method: "GOLIS",
        },
      ]),
    /method, name, phone number, and amount/,
  );
});
