import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { calculateTableTurnMetrics } from "../../src/lib/reports/table-turn-metrics";

const at = (minutes: number) => new Date(minutes * 60_000);

function order(
  overrides: Partial<Parameters<typeof calculateTableTurnMetrics>[0][number]> = {},
) {
  return {
    id: "order-1",
    type: "DINE_IN",
    createdAt: at(0),
    closedAt: at(30),
    tableCheck: null,
    ...overrides,
  };
}

test("deduplicates multiple order rounds from the same table check", () => {
  const tableCheck = {
    id: "check-1",
    createdAt: at(0),
    closedAt: at(45),
  };

  assert.deepEqual(
    calculateTableTurnMetrics([
      order({ id: "round-1", tableCheck }),
      order({ id: "round-2", createdAt: at(20), tableCheck }),
    ]),
    { completedTableChecks: 1, averageTableTurnMinutes: 45 },
  );
});

test("averages completed table checks to one decimal place", () => {
  assert.deepEqual(
    calculateTableTurnMetrics([
      order({
        id: "order-1",
        tableCheck: { id: "check-1", createdAt: at(0), closedAt: at(31) },
      }),
      order({
        id: "order-2",
        tableCheck: { id: "check-2", createdAt: at(0), closedAt: at(40) },
      }),
    ]),
    { completedTableChecks: 2, averageTableTurnMinutes: 35.5 },
  );
});

test("ignores non-dine-in, open, and invalid table checks", () => {
  assert.deepEqual(
    calculateTableTurnMetrics([
      order({ type: "TAKEOUT" }),
      order({
        id: "open",
        tableCheck: { id: "open-check", createdAt: at(0), closedAt: null },
      }),
      order({
        id: "invalid",
        tableCheck: { id: "invalid-check", createdAt: at(20), closedAt: at(10) },
      }),
    ]),
    { completedTableChecks: 0, averageTableTurnMinutes: null },
  );
});

test("uses order timestamps for legacy dine-in orders without table checks", () => {
  assert.deepEqual(
    calculateTableTurnMetrics([
      order({ id: "legacy-1", createdAt: at(5), closedAt: at(30) }),
      order({ id: "legacy-open", createdAt: at(5), closedAt: null }),
    ]),
    { completedTableChecks: 1, averageTableTurnMinutes: 25 },
  );
});

test("sales reporting loads table checks and presents the metric", async () => {
  const service = await readFile(
    new URL("../../src/lib/reports/services/sales-report-service.ts", import.meta.url),
    "utf8",
  );
  const page = await readFile(
    new URL("../../src/components/admin/reports/SalesReportPage.tsx", import.meta.url),
    "utf8",
  );

  assert.match(service, /tableCheck:\s*\{/);
  assert.match(service, /calculateTableTurnMetrics\(orders\)/);
  assert.match(page, /Average Table Turn/);
  assert.match(page, /completed table checks/);
});
