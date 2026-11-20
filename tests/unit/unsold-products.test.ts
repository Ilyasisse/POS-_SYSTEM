import assert from "node:assert/strict";
import test from "node:test";
import { unsoldProductsWhere } from "../../src/lib/reports/unsold-products";
import { resolveReportRange } from "../../src/lib/reports/resolve-range";
import { reportQuerySchema } from "../../src/lib/reports/validation";

test("unsold eligibility excludes archived and newly introduced products", () => {
  const range = { start: new Date("2026-09-01T04:00:00Z"), end: new Date("2026-09-08T02:00:00Z") };
  const where = unsoldProductsWhere(range);
  assert.equal(where.isActive, true);
  assert.deepEqual(where.category, { isActive: true });
  assert.deepEqual(where.createdAt, { lte: range.start });
  assert.deepEqual(where.orderItems, { none: { order: { status: "PAID", closedAt: { gte: range.start, lt: range.end } } } });
});

test("selected business dates cover overnight sales and exclude the closing boundary", () => {
  const range = resolveReportRange(reportQuerySchema.parse({ preset: "custom", from: "2026-09-01", to: "2026-09-01" }));
  assert.equal(range.start.toISOString(), "2026-09-01T04:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-09-02T02:00:00.000Z");
  assert.deepEqual(unsoldProductsWhere(range).orderItems, { none: { order: { status: "PAID", closedAt: { gte: range.start, lt: range.end } } } });
});
