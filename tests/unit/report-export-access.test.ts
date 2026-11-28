import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as permissions from "../../src/lib/auth/permissions";
import { exportReportPermissions } from "../../src/lib/reports/report-permissions";
import { visibleSalesReport } from "../../src/lib/reports/sales-report-visibility";
import { reportQuerySchema } from "../../src/lib/reports/validation";
import { resolveReportRange } from "../../src/lib/reports/resolve-range";

const sales = {
  summary: {
    cogs: "3.00",
    grossProfit: "7.00",
    grossMargin: "70.00",
    costCoveragePercent: "100.00",
    costCoveredLines: 1,
    totalLines: 1,
  },
  products: [
    {
      id: "product",
      name: "Tea",
      quantity: 1,
      grossSales: "10.00",
      cogs: "3.00",
      grossProfit: "7.00",
      missingCostLines: 0,
    },
  ],
  categories: [
    {
      id: "category",
      name: "Drinks",
      quantity: 1,
      grossSales: "10.00",
      cogs: "3.00",
      grossProfit: "7.00",
      missingCostLines: 0,
    },
  ],
};

function fixture(role: "ADMIN" | "MANAGER") {
  let reads = 0;
  let audits = 0;
  let exported: unknown;
  class NextResponse extends Response {
    static json(body: unknown, init?: ResponseInit) {
      return new Response(JSON.stringify(body), init);
    }
  }
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/lib/auth/permissions": permissions,
    "@/lib/auth/api-authorization": {
      authorizeApi: async () => ({ ok: true, user: { id: "staff", role } }),
    },
    "@/lib/prisma": {
      prisma: {
        reportExportAudit: {
          create: async () => {
            audits++;
          },
        },
      },
    },
    "@/lib/reports/report-permissions": { exportReportPermissions },
    "@/lib/reports/sales-report-visibility": { visibleSalesReport },
    "@/lib/reports/validation": { reportQuerySchema },
    "@/lib/reports/resolve-range": { resolveReportRange },
    "@/lib/reports/export-service": {
      getExportData: async () => {
        reads++;
        return sales;
      },
      flattenReport: (data: unknown) => {
        exported = data;
        return [];
      },
      toCsv: () => "csv",
      toXlsx: async () => Buffer.from("xlsx"),
      toPdf: async () => Buffer.from("pdf"),
      toPrintHtml: () => "html",
    },
  };
  const output = ts.transpileModule(
    readFileSync("src/app/api/admin/reports/export/route.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const exports: { POST?: (request: Request) => Promise<Response> } = {};
  vm.runInNewContext(output, {
    exports,
    require: (name: string) => dependencies[name] ?? {},
    URL,
    Uint8Array,
  });
  return {
    run: (report: string, format = "csv") =>
      exports.POST!(
        new Request(
          `https://pos.example/api/admin/reports/export?report=${report}&format=${format}`,
        ),
      ),
    reads: () => reads,
    audits: () => audits,
    exported: () => exported,
  };
}

test("manager export permission cannot bypass finance-report access", async () => {
  const f = fixture("MANAGER");
  assert.equal((await f.run("finance")).status, 403);
  assert.equal(f.reads(), 0);
  assert.equal(f.audits(), 0);
});

test("manager sales exports hide financial fields in every format", async () => {
  for (const format of ["csv", "xlsx", "pdf", "print"]) {
    const f = fixture("MANAGER");
    assert.equal((await f.run("sales", format)).status, 200);
    const result = f.exported() as typeof sales;
    assert.equal(result.summary.cogs, null);
    assert.equal(result.summary.grossProfit, null);
    assert.equal("cogs" in result.products[0], false);
    assert.equal("grossProfit" in result.categories[0], false);
    assert.equal(result.products[0].grossSales, "10.00");
    assert.equal(f.audits(), 1);
  }
});

test("admin exports retain financial data and finance access", async () => {
  const f = fixture("ADMIN");
  assert.equal((await f.run("sales")).status, 200);
  assert.equal((f.exported() as typeof sales).summary.cogs, "3.00");
  assert.equal((await f.run("finance")).status, 200);
});
