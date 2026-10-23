import assert from "node:assert/strict";
import test from "node:test";
import {
  currentCafeMonth,
  formatWorkMinutes,
  parseLaborMonth,
} from "../../src/lib/reports/labor-month";

test("selects a bounded UTC date range for café attendance dates", () => {
  const february = parseLaborMonth("2028-02", "2028-04");
  assert.equal(february.start.toISOString(), "2028-02-01T00:00:00.000Z");
  assert.equal(february.end.toISOString(), "2028-03-01T00:00:00.000Z");
  assert.equal(parseLaborMonth("2028-05", "2028-04").month, "2028-04");
  assert.equal(parseLaborMonth("2028-00", "2028-04").month, "2028-04");
});

test("uses the café's month across a UTC midnight boundary", () => {
  assert.equal(
    currentCafeMonth(new Date("2026-09-30T22:30:00.000Z")),
    "2026-10",
  );
  assert.equal(formatWorkMinutes(493), "8h 13m");
});
