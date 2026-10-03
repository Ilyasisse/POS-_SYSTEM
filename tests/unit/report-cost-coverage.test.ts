import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { Prisma } from "@prisma/client";
import * as formulas from "../../src/lib/reports/financial-formulas";
import { reportQuerySchema } from "../../src/lib/reports/validation";

function load<T>(path: string, dependencies: Record<string, unknown>): T {
  const output = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, {
    exports,
    require: (name: string) => dependencies[name] ?? {},
    Date,
    Intl,
  });
  return exports as T;
}
const range = {
  start: new Date("2026-10-01T04:00:00Z"),
  end: new Date("2026-10-02T02:00:00Z"),
};
const query = reportQuerySchema.parse({});
const decimal = (value: number) => new Prisma.Decimal(value);

function salesFixture(costs: Array<number | null>) {
  const order = {
    id: "order",
    orderNumber: 1,
    total: decimal(20),
    closedAt: new Date("2026-10-01T10:00:00Z"),
    createdAt: new Date("2026-10-01T09:00:00Z"),
    waiter: null,
    cashier: null,
    table: null,
    payments: [],
    salesAdjustments: [],
    orderItems: costs.map((cost, index) => ({
      productId: `product-${index}`,
      productName: `Product ${index}`,
      qty: 1,
      lineTotal: decimal(10),
      unitCostSnapshot: cost === null ? null : decimal(cost),
      product: { category: { id: "category", name: "Food" } },
    })),
  };
  return load<
    typeof import("../../src/lib/reports/services/sales-report-service")
  >("src/lib/reports/services/sales-report-service.ts", {
    "@prisma/client": { Prisma },
    "@/lib/reports/financial-formulas": formulas,
    "@/lib/prisma": {
      prisma: {
        order: { findMany: async () => [order], count: async () => 0 },
      },
    },
  });
}

test("incomplete cost snapshots leave aggregate COGS and profit unavailable", async () => {
  const report = await salesFixture([3, null]).getSalesReport(range, query);
  assert.equal(report.summary.costCoveragePercent, "50.00");
  assert.equal(report.summary.cogs, null);
  assert.equal(report.summary.grossProfit, null);
  assert.equal(
    report.products.find((row) => row.id === "product-0")?.cogs,
    "3.00",
  );
  assert.equal(
    report.products.find((row) => row.id === "product-1")?.cogs,
    null,
  );
});

test("fully covered zero-cost items still produce a valid profit", async () => {
  const report = await salesFixture([0, 0]).getSalesReport(range, query);
  assert.equal(report.summary.cogs, "0.00");
  assert.equal(report.summary.grossProfit, "20.00");
});

test("finance never treats partial COGS as a complete expense", async () => {
  for (const covered of [1, 2]) {
    const report = load<
      typeof import("../../src/lib/reports/services/advanced-report-service")
    >("src/lib/reports/services/advanced-report-service.ts", {
      "@prisma/client": { Prisma },
      "@/lib/reports/services/sales-report-service": {
        getSalesReport: async () => ({
          summary: {
            netSales: "20.00",
            cogs: "3.00",
            costCoveredLines: covered,
            totalLines: 2,
            costCoveragePercent: covered === 2 ? "100.00" : "50.00",
          },
        }),
      },
      "@/lib/prisma": {
        prisma: {
          expenseTransaction: {
            aggregate: async () => ({ _sum: { amount: decimal(2) } }),
          },
          ownerWithdrawal: {
            aggregate: async () => ({ _sum: { amount: decimal(1) } }),
          },
          payrollLine: {
            aggregate: async () => ({ _sum: { netPay: decimal(4) } }),
          },
        },
      },
    });
    const result = await report.getFinanceReport(range, query);
    assert.equal(result.cogs, covered === 2 ? "3.00" : null);
    assert.equal(result.netProfit, covered === 2 ? "11.00" : null);
  }
});
