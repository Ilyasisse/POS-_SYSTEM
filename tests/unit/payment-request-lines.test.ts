import assert from "node:assert/strict";
import test from "node:test";
import {
  preparePaymentRequestLines,
} from "../../src/lib/payments/payment-request-lines";

test("keeps an independent payment method for every payer", () => {
  const lines = preparePaymentRequestLines([
    { payerName: "Amina", payerPhone: "090000001", amount: 5, method: "GOLIS" },
    { payerName: "Hassan", payerPhone: "090000002", amount: 7.5, method: "MYCASH" },
  ]);

  assert.deepEqual(
    lines.map((line) => [line.method, line.amountCents]),
    [["GOLIS", 500], ["MYCASH", 750]],
  );
});

test("supports the previous batch-level method as a fallback", () => {
  const [line] = preparePaymentRequestLines(
    [{ payerName: "Amina", payerPhone: "090000001", amount: 4 }],
    "Dahabshiil",
  );
  assert.equal(line?.method, "Dahabshiil");
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
