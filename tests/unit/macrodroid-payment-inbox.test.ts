import { expect, test } from "@jest/globals";

import { getPaymentReceiptBusinessDayRange } from "../../src/lib/cashier/cashier-business-day";
import {
  expectedMacrodroidSender,
  isMacrodroidAuthorized,
  isExpectedMacrodroidSender,
  resolveMacrodroidSecret,
} from "../../src/lib/payments/macrodroid-auth";
import { fingerprintSms, parseSahalMessage } from "../../src/lib/payments/macrodroid-sahal";

const outgoingOne =
  "[SAHAL] Tix:7325501161, $ 230.55 ayaad u dirtay AL XAMDULILAAH ROOTI IYO MACMACAANKA 7527830(252907527830) Tar 31/08/26 05:24:37, Haraagaagu waa $0.";
const outgoingTwo =
  "[SAHAL] Tix: 7325500382, $ 5 ayaad u dirtay ILYAAS AXMED CIISE(252907028702) Tar 31/08/26 05:47:14,Haraagaagu waa $230.55.";
const incoming =
  "[SAHAL] Tix:7325497979, Waxaad $26 ka heshay KAWAANKA HILIBKA EE AANFAC 6488347 7791832(252905109687) Tar 31/08/26 05:21:59, Haraagaagu waa $235.55.";

test("parses outgoing SAHAL with a long label and every attached number", () => {
  const parsed = parseSahalMessage(outgoingOne);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) return;
  expect({
    reference: parsed.providerReference,
    direction: parsed.direction,
    status: parsed.status,
    amount: parsed.amount,
    counterparty: parsed.counterpartyLabel,
    identifiers: parsed.counterpartyIdentifiers,
    time: parsed.transactionAt.toISOString(),
    balance: parsed.providerBalance,
  }).toStrictEqual({
    reference: "7325501161",
    direction: "OUTGOING",
    status: "OUTGOING",
    amount: "230.55",
    counterparty: "AL XAMDULILAAH ROOTI IYO MACMACAANKA 7527830(252907527830)",
    identifiers: ["7527830", "252907527830"],
    time: "2026-08-31T02:24:37.000Z",
    balance: "0.00",
  });
});

test("parses outgoing SAHAL spacing variations", () => {
  const parsed = parseSahalMessage(outgoingTwo);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) return;
  expect(parsed.providerReference).toBe("7325500382");
  expect(parsed.amount).toBe("5.00");
  expect(parsed.counterpartyLabel).toBe("ILYAAS AXMED CIISE(252907028702)");
  expect(parsed.counterpartyIdentifiers).toStrictEqual(["252907028702"]);
  expect(parsed.transactionAt.toISOString()).toBe("2026-08-31T02:47:14.000Z");
  expect(parsed.providerBalance).toBe("230.55");
});

test("parses incoming SAHAL as available and preserves all numbers", () => {
  const parsed = parseSahalMessage(incoming);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) return;
  expect(parsed.providerReference).toBe("7325497979");
  expect(parsed.direction).toBe("INCOMING");
  expect(parsed.status).toBe("AVAILABLE");
  expect(parsed.amount).toBe("26.00");
  expect(parsed.counterpartyLabel).toBe("KAWAANKA HILIBKA EE AANFAC 6488347 7791832(252905109687)");
  expect(parsed.counterpartyIdentifiers).toStrictEqual(["6488347", "7791832", "252905109687"]);
  expect(parsed.transactionAt.toISOString()).toBe("2026-08-31T02:21:59.000Z");
  expect(parsed.providerBalance).toBe("235.55");
});

test("routes malformed messages to Needs Review", () => {
  expect(parseSahalMessage("A balance message without a Tix")).toStrictEqual({
    ok: false,
    direction: "UNKNOWN",
    status: "NEEDS_REVIEW",
    error: "The SMS does not match the SAHAL transaction header.",
  });
});

test("fingerprints normalize whitespace but retain sender", () => {
  expect(fingerprintSms("898", incoming)).toBe(
    fingerprintSms("898", `  ${incoming.replaceAll(" ", "   ")}  `),
  );
  expect(fingerprintSms("898", incoming)).not.toBe(fingerprintSms("899", incoming));
});

test("MacroDroid secret prefers the dedicated value and falls back to the shared value", () => {
  expect(
    resolveMacrodroidSecret({
      MACRODROID_PAYMENT_WEBHOOK_SECRET: " dedicated ",
      PAYMENT_WEBHOOK_SECRET: "shared",
    }),
  ).toBe("dedicated");
  expect(
    resolveMacrodroidSecret({
      MACRODROID_PAYMENT_WEBHOOK_SECRET: " ",
      PAYMENT_WEBHOOK_SECRET: " shared ",
    }),
  ).toBe("shared");
  expect(resolveMacrodroidSecret({})).toBe("");
});

test("bearer authentication rejects absent and incorrect values", () => {
  const env = { PAYMENT_WEBHOOK_SECRET: "shared-secret" };
  expect(
    isMacrodroidAuthorized(
      new Request("https://example.test", {
        headers: { Authorization: "Bearer shared-secret" },
      }),
      env,
    ),
  ).toBe(true);
  expect(
    isMacrodroidAuthorized(
      new Request("https://example.test", {
        headers: { Authorization: "Bearer wrong" },
      }),
      env,
    ),
  ).toBe(false);
  expect(isMacrodroidAuthorized(new Request("https://example.test"), env)).toBe(false);
  expect(
    isMacrodroidAuthorized(
      new Request("https://example.test", {
        headers: { Authorization: "Bearer shared-secret" },
      }),
      {},
    ),
  ).toBe(false);
});

test("sender defaults to 898 and can be configured", () => {
  expect(expectedMacrodroidSender({})).toBe("898");
  expect(isExpectedMacrodroidSender(" 898 ", {})).toBe(true);
  expect(isExpectedMacrodroidSender("A98", {})).toBe(false);
  expect(isExpectedMacrodroidSender("A98", { MACRODROID_PAYMENT_SMS_SENDER: "a98" })).toBe(true);
});

test("5:00 through 7:00 Nairobi belongs to the preceding receipt business day", () => {
  const beforeSeven = getPaymentReceiptBusinessDayRange(new Date("2026-08-31T03:30:00.000Z"));
  expect(beforeSeven.start.toISOString()).toBe("2026-08-30T04:00:00.000Z");
  expect(beforeSeven.end.toISOString()).toBe("2026-08-31T04:00:00.000Z");

  const atSeven = getPaymentReceiptBusinessDayRange(new Date("2026-08-31T04:00:00.000Z"));
  expect(atSeven.start.toISOString()).toBe("2026-08-31T04:00:00.000Z");
  expect(atSeven.end.toISOString()).toBe("2026-09-01T04:00:00.000Z");
});
