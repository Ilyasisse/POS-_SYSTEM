import assert from "node:assert/strict";
import test from "node:test";
import { summarizeInventoryLosses } from "../../src/lib/reports/inventory-losses";

test("separates causes and units, sums precise cost snapshots, and exposes gaps", () => {
  const input = [
    {
      productId: null,
      supplyId: "beans",
      name: "Beans",
      type: "WASTE" as const,
      canonicalUnit: "GRAM" as const,
      quantityDelta: "-0.125000",
      standardUnitCostSnapshot: "2.000000",
      dataCoverage: "COMPLETE",
    },
    {
      productId: null,
      supplyId: "beans",
      name: "Beans",
      type: "WASTE" as const,
      canonicalUnit: "GRAM" as const,
      quantityDelta: "-1",
      standardUnitCostSnapshot: null,
      dataCoverage: "MISSING_COST",
    },
    {
      productId: null,
      supplyId: "beans",
      name: "Beans",
      type: "DAMAGE" as const,
      canonicalUnit: "GRAM" as const,
      quantityDelta: "-1",
      standardUnitCostSnapshot: "1.000000",
      dataCoverage: "COMPLETE",
    },
    {
      productId: "beans",
      supplyId: null,
      name: "Beans product",
      type: "WASTE" as const,
      canonicalUnit: "PIECE" as const,
      quantityDelta: "-1",
      standardUnitCostSnapshot: "3.000000",
      dataCoverage: "COMPLETE",
    },
  ];
  const report = summarizeInventoryLosses(input);
  assert.equal(report.eventCount, 4);
  assert.equal(report.coveredEvents, 3);
  assert.equal(report.missingCostEvents, 1);
  assert.equal(report.knownCost, "4.25");
  assert.deepEqual(
    report.rows.map((row) => [
      row.name,
      row.events,
      row.quantity,
      row.knownCost,
    ]),
    [
      ["Beans", 2, "1.125", "0.25"],
      ["Beans", 1, "1", "1.00"],
      ["Beans product", 1, "1", "3.00"],
    ],
  );
});
