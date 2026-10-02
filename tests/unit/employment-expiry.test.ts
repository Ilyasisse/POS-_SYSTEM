import assert from "node:assert/strict";
import test from "node:test";
import {
  employmentReviewFilter,
  employmentReviewWindow,
} from "../../src/lib/staff/employment-expiry";

test("employment expiry uses the Nairobi calendar day and inclusive 30-day window", () => {
  const { today, afterThirtyDays } = employmentReviewWindow(
    new Date("2026-09-28T21:30:00Z"),
  );
  assert.equal(today.toISOString(), "2026-09-29T00:00:00.000Z");
  assert.equal(afterThirtyDays.toISOString(), "2026-10-30T00:00:00.000Z");
  assert.equal(employmentReviewFilter("expired"), "expired");
  assert.equal(employmentReviewFilter("unknown"), "all");
});
