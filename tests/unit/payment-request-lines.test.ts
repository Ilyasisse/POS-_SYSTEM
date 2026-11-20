import { expect, test } from "@jest/globals";

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

  expect(lines.map((line) => [line.method, line.amountCents])).toStrictEqual([
    ["GOLIS", 500],
    ["MYCASH", 750],
  ]);
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
  expect(lines.map((line) => line.method)).toStrictEqual(["Dahabshiil", "Dahabshiil", "GOLIS"]);
});

test("rejects an invalid explicit method even with a batch fallback", () => {
  expect(() =>
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
  ).toThrow(/method, name, phone number, and amount/);
});

test("requires complete payer and payment details", () => {
  expect(() =>
    preparePaymentRequestLines([{ payerName: "Amina", payerPhone: "090000001", amount: 5 }]),
  ).toThrow(/method, name, phone number, and amount/);
  expect(() => preparePaymentRequestLines([])).toThrow(/at least one payer/);
  expect(() =>
    preparePaymentRequestLines([
      {
        payerName: "Amina",
        payerPhone: "090000001",
        amount: Number.NaN,
        method: "GOLIS",
      },
    ]),
  ).toThrow(/method, name, phone number, and amount/);
});
