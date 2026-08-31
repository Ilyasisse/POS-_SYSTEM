import assert from "node:assert/strict";
import test from "node:test";
import { getPaymentReceiptBusinessDayRange } from "../../src/lib/cashier/cashier-business-day";
import {
  expectedMacrodroidSender,
  isMacrodroidAuthorized,
  isExpectedMacrodroidSender,
  resolveMacrodroidSecret,
} from "../../src/lib/payments/macrodroid-auth";
import {
  fingerprintSms,
  parseSahalMessage,
} from "../../src/lib/payments/macrodroid-sahal";

const outgoingOne = "[SAHAL] Tix:7325501161, $ 230.55 ayaad u dirtay AL XAMDULILAAH ROOTI IYO MACMACAANKA 7527830(252907527830) Tar 31/08/26 05:24:37, Haraagaagu waa $0.";
const outgoingTwo = "[SAHAL] Tix: 7325500382, $ 5 ayaad u dirtay ILYAAS AXMED CIISE(252907028702) Tar 31/08/26 05:47:14,Haraagaagu waa $230.55.";
const incoming = "[SAHAL] Tix:7325497979, Waxaad $26 ka heshay KAWAANKA HILIBKA EE AANFAC 6488347 7791832(252905109687) Tar 31/08/26 05:21:59, Haraagaagu waa $235.55.";

test("parses outgoing SAHAL with a long label and every attached number", () => {
  const parsed = parseSahalMessage(outgoingOne);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(
    {
      reference: parsed.providerReference,
      direction: parsed.direction,
      status: parsed.status,
      amount: parsed.amount,
      counterparty: parsed.counterpartyLabel,
      identifiers: parsed.counterpartyIdentifiers,
      time: parsed.transactionAt.toISOString(),
      balance: parsed.providerBalance,
    },
    {
      reference: "7325501161",
      direction: "OUTGOING",
      status: "OUTGOING",
      amount: "230.55",
      counterparty: "AL XAMDULILAAH ROOTI IYO MACMACAANKA 7527830(252907527830)",
      identifiers: ["7527830", "252907527830"],
      time: "2026-08-31T02:24:37.000Z",
      balance: "0.00",
    },
  );
});

test("parses outgoing SAHAL spacing variations", () => {
  const parsed = parseSahalMessage(outgoingTwo);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.providerReference, "7325500382");
  assert.equal(parsed.amount, "5.00");
  assert.equal(parsed.counterpartyLabel, "ILYAAS AXMED CIISE(252907028702)");
  assert.deepEqual(parsed.counterpartyIdentifiers, ["252907028702"]);
  assert.equal(parsed.transactionAt.toISOString(), "2026-08-31T02:47:14.000Z");
  assert.equal(parsed.providerBalance, "230.55");
});

test("parses incoming SAHAL as available and preserves all numbers", () => {
  const parsed = parseSahalMessage(incoming);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.providerReference, "7325497979");
  assert.equal(parsed.direction, "INCOMING");
  assert.equal(parsed.status, "AVAILABLE");
  assert.equal(parsed.amount, "26.00");
  assert.equal(parsed.counterpartyLabel, "KAWAANKA HILIBKA EE AANFAC 6488347 7791832(252905109687)");
  assert.deepEqual(parsed.counterpartyIdentifiers, ["6488347", "7791832", "252905109687"]);
  assert.equal(parsed.transactionAt.toISOString(), "2026-08-31T02:21:59.000Z");
  assert.equal(parsed.providerBalance, "235.55");
});

test("routes malformed messages to Needs Review", () => {
  assert.deepEqual(parseSahalMessage("A balance message without a Tix"), {
    ok: false,
    direction: "UNKNOWN",
    status: "NEEDS_REVIEW",
    error: "The SMS does not match the SAHAL transaction header.",
  });
});

test("fingerprints normalize whitespace but retain sender", () => {
  assert.equal(fingerprintSms("898", incoming), fingerprintSms("898", `  ${incoming.replaceAll(" ", "   ")}  `));
  assert.notEqual(fingerprintSms("898", incoming), fingerprintSms("899", incoming));
});

test("MacroDroid secret prefers the dedicated value and falls back to the shared value", () => {
  assert.equal(resolveMacrodroidSecret({ MACRODROID_PAYMENT_WEBHOOK_SECRET: " dedicated ", PAYMENT_WEBHOOK_SECRET: "shared" }), "dedicated");
  assert.equal(resolveMacrodroidSecret({ MACRODROID_PAYMENT_WEBHOOK_SECRET: " ", PAYMENT_WEBHOOK_SECRET: " shared " }), "shared");
  assert.equal(resolveMacrodroidSecret({}), "");
});

test("bearer authentication rejects absent and incorrect values", () => {
  const env = { PAYMENT_WEBHOOK_SECRET: "shared-secret" };
  assert.equal(isMacrodroidAuthorized(new Request("https://example.test", { headers: { Authorization: "Bearer shared-secret" } }), env), true);
  assert.equal(isMacrodroidAuthorized(new Request("https://example.test", { headers: { Authorization: "Bearer wrong" } }), env), false);
  assert.equal(isMacrodroidAuthorized(new Request("https://example.test"), env), false);
  assert.equal(isMacrodroidAuthorized(new Request("https://example.test", { headers: { Authorization: "Bearer shared-secret" } }), {}), false);
});

test("sender defaults to 898 and can be configured", () => {
  assert.equal(expectedMacrodroidSender({}), "898");
  assert.equal(isExpectedMacrodroidSender(" 898 ", {}), true);
  assert.equal(isExpectedMacrodroidSender("A98", {}), false);
  assert.equal(isExpectedMacrodroidSender("A98", { MACRODROID_PAYMENT_SMS_SENDER: "a98" }), true);
});

test("5:00 through 7:00 Nairobi belongs to the preceding receipt business day", () => {
  const beforeSeven = getPaymentReceiptBusinessDayRange(new Date("2026-08-31T03:30:00.000Z"));
  assert.equal(beforeSeven.start.toISOString(), "2026-08-30T04:00:00.000Z");
  assert.equal(beforeSeven.end.toISOString(), "2026-08-31T04:00:00.000Z");

  const atSeven = getPaymentReceiptBusinessDayRange(new Date("2026-08-31T04:00:00.000Z"));
  assert.equal(atSeven.start.toISOString(), "2026-08-31T04:00:00.000Z");
  assert.equal(atSeven.end.toISOString(), "2026-09-01T04:00:00.000Z");
});
