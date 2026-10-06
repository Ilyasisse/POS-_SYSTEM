import assert from "node:assert/strict";
import test from "node:test";
import { marketingConsentChange } from "../../src/lib/customer/marketing-consent";

const now = new Date("2026-09-23T09:00:00Z");

test("customers must explicitly opt in and can withdraw again", () => {
  assert.deepEqual(marketingConsentChange(false, "opt-in", now), {
    ok: true,
    changed: true,
    data: { marketingEmailConsentAt: now, marketingEmailRevokedAt: null },
  });
  assert.deepEqual(marketingConsentChange(true, "withdraw", now), {
    ok: true,
    changed: true,
    data: { marketingEmailConsentAt: null, marketingEmailRevokedAt: now },
  });
});

test("repeated requests are no-ops and invalid instructions fail", () => {
  assert.equal(marketingConsentChange(true, "opt-in", now).changed, false);
  assert.equal(marketingConsentChange(false, "withdraw", now).changed, false);
  assert.equal(marketingConsentChange(false, "send-all", now).ok, false);
});
