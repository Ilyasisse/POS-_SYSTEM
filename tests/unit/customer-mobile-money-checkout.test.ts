import { expect, test } from "@jest/globals";

import {
  androidDialerHref,
  chooseUniqueCustomerCheckout,
  customerUssdCode,
  customerPaymentNameMatches,
  formatCustomerUssdAmount,
  normalizeSomaliPhone,
  normalizeCustomerPaymentPhone,
} from "../../src/lib/payments/customer-ussd";

test("formats the exact cafe USSD code without decimals for whole amounts", () => {
  expect(customerUssdCode(26)).toBe("*884*430935*26#");
  expect(customerUssdCode(26.5)).toBe("*884*430935*26.50#");
  expect(formatCustomerUssdAmount(0.75)).toBe("0.75");
  expect(androidDialerHref("*884*430935*26#")).toBe("tel:*884*430935*26%23");
});

test("normalizes Somali mobile numbers without accepting unrelated identifiers", () => {
  expect(normalizeSomaliPhone("+252 90 510 9687")).toBe("252905109687");
  expect(normalizeSomaliPhone("0905109687")).toBe("252905109687");
  expect(normalizeSomaliPhone("905109687")).toBe("252905109687");
  expect(normalizeSomaliPhone("430935")).toBe(null);
  expect(normalizeSomaliPhone("252905109687#")).toBe(null);
});

test("automatically selects only a unique exact receipt match in the payment window", () => {
  const now = new Date("2026-09-18T06:00:30Z");
  const createdAt = new Date("2026-09-18T06:00:00.800Z");
  const expiresAt = new Date("2026-09-18T06:15:00Z");
  const candidate = {
    id: "checkout-1",
    customerName: "Ali Hassan",
    amount: 26,
    payerPhone: "252905109687",
    createdAt,
    expiresAt,
  };
  const receipt = {
    amount: 26,
    counterpartyLabel: "Ali Hassan Mohamed 252905109687",
    identifiers: ["430935", "252905109687"],
    transactionAt: new Date("2026-09-18T06:00:00Z"),
  };
  expect(chooseUniqueCustomerCheckout(receipt, [candidate], now)).toBe("checkout-1");
  expect(
    chooseUniqueCustomerCheckout(receipt, [candidate, { ...candidate, id: "checkout-2" }], now),
  ).toBe(null);
  expect(
    chooseUniqueCustomerCheckout({ ...receipt, identifiers: ["430935"] }, [candidate], now),
  ).toBe(null);
  expect(chooseUniqueCustomerCheckout({ ...receipt, amount: 25 }, [candidate], now)).toBe(null);
  expect(
    chooseUniqueCustomerCheckout(
      { ...receipt, transactionAt: new Date("2026-09-18T05:59:58Z") },
      [candidate],
      now,
    ),
  ).toBe(null);
  expect(chooseUniqueCustomerCheckout(receipt, [candidate], new Date("2026-09-18T06:15:01Z"))).toBe(
    null,
  );
});

test("checkout accepts only local 90 and seven digits; country prefixes are receipt-only", () => {
  expect(normalizeCustomerPaymentPhone("901234567")).toBe("252901234567");
  for (const value of [
    "",
    "90123456",
    "9012345678",
    "911234567",
    "+252901234567",
    "90 1234567",
    "90abcdefg",
    " 901234567",
  ]) {
    expect({ context: value, value: normalizeCustomerPaymentPhone(value) }).toStrictEqual({
      context: value,
      value: null,
    });
  }
});
test("late, wrong-phone and wrong-amount receipts require review", () => {
  const createdAt = new Date("2026-09-30T10:00:00Z");
  const expiresAt = new Date("2026-09-30T10:15:00Z");
  const candidates = [
    {
      id: "one",
      customerName: "Ali Hassan",
      amount: 10.5,
      payerPhone: "252901234567",
      createdAt,
      expiresAt,
    },
  ];
  const receipt = {
    counterpartyLabel: "Ali Hassan Mohamed",
    amount: 10.5,
    identifiers: ["252901234567"],
    transactionAt: expiresAt,
  };
  expect(chooseUniqueCustomerCheckout(receipt, candidates, expiresAt)).toBe("one");
  expect(
    chooseUniqueCustomerCheckout(
      { ...receipt, transactionAt: new Date("2026-09-30T10:15:01Z") },
      candidates,
      expiresAt,
    ),
  ).toBe(null);
  expect(
    chooseUniqueCustomerCheckout(
      { ...receipt, identifiers: ["252901234568"] },
      candidates,
      expiresAt,
    ),
  ).toBe(null);
  expect(chooseUniqueCustomerCheckout({ ...receipt, amount: 10.49 }, candidates, expiresAt)).toBe(
    null,
  );
});

test("payment names require two distinct complete matching words", () => {
  for (const customer of ["Ali Hassan", "Ali Mohamed", "Hassan Mohamed", "Ali Hassan Mohamed"]) {
    expect({
      context: customer,
      value: customerPaymentNameMatches(customer, "252905109687 (ALI HASSAN MOHAMED)"),
    }).toStrictEqual({ context: customer, value: true });
  }
  for (const customer of ["Ali", "Ali Yusuf", "Al Hassan", "Ali Ali", "", "HassanAli Yusuf"]) {
    expect({
      context: customer,
      value: customerPaymentNameMatches(customer, "Ali Hassan Mohamed"),
    }).toStrictEqual({ context: customer, value: false });
  }
  expect(customerPaymentNameMatches("  Hassan, ALI  ", "Ali Hassan Mohamed")).toBe(true);
  expect(customerPaymentNameMatches("Ali Hassan", null)).toBe(false);
  expect(customerPaymentNameMatches("Ali Hassan", "")).toBe(false);
});

test("automatic approval fails closed for missing names and invalid amounts", () => {
  const createdAt = new Date("2026-10-01T10:00:00Z");
  const expiresAt = new Date("2026-10-01T10:15:00Z");
  const candidate = {
    id: "checkout",
    customerName: "Ali Hassan",
    payerPhone: "252905109687",
    amount: 26,
    createdAt,
    expiresAt,
  };
  const receipt = {
    amount: 26,
    counterpartyLabel: "Ali Hassan Mohamed",
    identifiers: [candidate.payerPhone],
    transactionAt: new Date("2026-10-01T10:05:00Z"),
  };
  for (const counterpartyLabel of [null, "Ali Yusuf Mohamed", "Ali Ali Ali"]) {
    expect(
      chooseUniqueCustomerCheckout(
        { ...receipt, counterpartyLabel },
        [candidate],
        receipt.transactionAt,
      ),
    ).toBe(null);
  }
  for (const amount of [NaN, Infinity, -26, 0, 26.001]) {
    expect(
      chooseUniqueCustomerCheckout({ ...receipt, amount }, [candidate], receipt.transactionAt),
    ).toBe(null);
  }
  expect(
    chooseUniqueCustomerCheckout(
      receipt,
      [candidate, { ...candidate, id: "other", customerName: "Ali Yusuf" }],
      receipt.transactionAt,
    ),
  ).toBe("checkout");
});
