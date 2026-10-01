import assert from "node:assert/strict";
import test from "node:test";
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
  assert.equal(customerUssdCode(26), "*884*430935*26#");
  assert.equal(customerUssdCode(26.5), "*884*430935*26.50#");
  assert.equal(formatCustomerUssdAmount(0.75), "0.75");
  assert.equal(androidDialerHref("*884*430935*26#"), "tel:*884*430935*26%23");
});

test("normalizes Somali mobile numbers without accepting unrelated identifiers", () => {
  assert.equal(normalizeSomaliPhone("+252 90 510 9687"), "252905109687");
  assert.equal(normalizeSomaliPhone("0905109687"), "252905109687");
  assert.equal(normalizeSomaliPhone("905109687"), "252905109687");
  assert.equal(normalizeSomaliPhone("430935"), null);
  assert.equal(normalizeSomaliPhone("252905109687#"), null);
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
  assert.equal(
    chooseUniqueCustomerCheckout(receipt, [candidate], now),
    "checkout-1",
  );
  assert.equal(
    chooseUniqueCustomerCheckout(
      receipt,
      [candidate, { ...candidate, id: "checkout-2" }],
      now,
    ),
    null,
  );
  assert.equal(
    chooseUniqueCustomerCheckout(
      { ...receipt, identifiers: ["430935"] },
      [candidate],
      now,
    ),
    null,
  );
  assert.equal(
    chooseUniqueCustomerCheckout({ ...receipt, amount: 25 }, [candidate], now),
    null,
  );
  assert.equal(
    chooseUniqueCustomerCheckout(
      { ...receipt, transactionAt: new Date("2026-09-18T05:59:58Z") },
      [candidate],
      now,
    ),
    null,
  );
  assert.equal(
    chooseUniqueCustomerCheckout(
      receipt,
      [candidate],
      new Date("2026-09-18T06:15:01Z"),
    ),
    null,
  );
});

test("checkout accepts only local 90 and seven digits; country prefixes are receipt-only", () => {
  assert.equal(normalizeCustomerPaymentPhone("901234567"), "252901234567");
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
    assert.equal(normalizeCustomerPaymentPhone(value), null, value);
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
  assert.equal(
    chooseUniqueCustomerCheckout(receipt, candidates, expiresAt),
    "one",
  );
  assert.equal(
    chooseUniqueCustomerCheckout(
      { ...receipt, transactionAt: new Date("2026-09-30T10:15:01Z") },
      candidates,
      expiresAt,
    ),
    null,
  );
  assert.equal(
    chooseUniqueCustomerCheckout(
      { ...receipt, identifiers: ["252901234568"] },
      candidates,
      expiresAt,
    ),
    null,
  );
  assert.equal(
    chooseUniqueCustomerCheckout(
      { ...receipt, amount: 10.49 },
      candidates,
      expiresAt,
    ),
    null,
  );
});

test("payment names require two distinct complete matching words", () => {
  for (const customer of [
    "Ali Hassan",
    "Ali Mohamed",
    "Hassan Mohamed",
    "Ali Hassan Mohamed",
  ]) {
    assert.equal(
      customerPaymentNameMatches(customer, "252905109687 (ALI HASSAN MOHAMED)"),
      true,
      customer,
    );
  }
  for (const customer of [
    "Ali",
    "Ali Yusuf",
    "Al Hassan",
    "Ali Ali",
    "",
    "HassanAli Yusuf",
  ]) {
    assert.equal(
      customerPaymentNameMatches(customer, "Ali Hassan Mohamed"),
      false,
      customer,
    );
  }
  assert.equal(
    customerPaymentNameMatches("  Hassan, ALI  ", "Ali Hassan Mohamed"),
    true,
  );
  assert.equal(customerPaymentNameMatches("Ali Hassan", null), false);
  assert.equal(customerPaymentNameMatches("Ali Hassan", ""), false);
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
    assert.equal(
      chooseUniqueCustomerCheckout(
        { ...receipt, counterpartyLabel },
        [candidate],
        receipt.transactionAt,
      ),
      null,
    );
  }
  for (const amount of [NaN, Infinity, -26, 0, 26.001]) {
    assert.equal(
      chooseUniqueCustomerCheckout(
        { ...receipt, amount },
        [candidate],
        receipt.transactionAt,
      ),
      null,
    );
  }
  assert.equal(
    chooseUniqueCustomerCheckout(
      receipt,
      [candidate, { ...candidate, id: "other", customerName: "Ali Yusuf" }],
      receipt.transactionAt,
    ),
    "checkout",
  );
});
