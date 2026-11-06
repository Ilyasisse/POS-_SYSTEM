import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { Prisma } from "@prisma/client";
import { preparePaymentRequestLines } from "../../src/lib/payments/payment-request-lines";
import { assertTableTransferAllowed } from "../../src/lib/cashier/table-transfer-validation";

const valid = {
  sourceTableId: "table-1",
  targetTableId: "table-2",
  sourceExists: true,
  targetExists: true,
  sourceOpenOrderCount: 2,
  targetOpenOrderCount: 0,
};

test("allows moving open service to an available table", () => {
  assert.doesNotThrow(() => assertTableTransferAllowed(valid));
});

test("rejects occupied destinations and stale source tables", () => {
  assert.throws(
    () => assertTableTransferAllowed({ ...valid, targetOpenOrderCount: 1 }),
    /already occupied/,
  );
  assert.throws(
    () => assertTableTransferAllowed({ ...valid, sourceOpenOrderCount: 0 }),
    /no longer has an open order/,
  );
});

test("rejects inactive, missing, or identical tables", () => {
  assert.throws(
    () => assertTableTransferAllowed({ ...valid, targetExists: false }),
    /must be active/,
  );
  assert.throws(
    () =>
      assertTableTransferAllowed({
        ...valid,
        targetTableId: valid.sourceTableId,
      }),
    /different destination/,
  );
});

function loadService(path: string, prisma: unknown) {
  const loadedModule = { exports: {} as Record<string, (...args: never[]) => Promise<unknown>> };
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, {
    module: loadedModule, exports: loadedModule.exports,
    require: (name: string) => {
      if (name === "@prisma/client") return { Prisma };
      if (name === "@/lib/prisma") return { prisma };
      if (name === "@/lib/cashier/table-transfer-validation") return { assertTableTransferAllowed };
      if (name === "@/lib/cashier/table-checks") return {};
      if (name === "@/lib/payments/payment-request-lines") return { preparePaymentRequestLines };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return loadedModule.exports;
}

test("moving service locks active payer rows before orders and moves partial requests", async () => {
  const payer = { tableId: valid.sourceTableId, status: "PARTIALLY_MATCHED" };
  const locked: string[] = [];
  const service = loadService("src/lib/cashier/table-transfer.ts", {
    $transaction: async (run: (tx: unknown) => Promise<unknown>) => run({
      $queryRaw: async (query: Prisma.Sql) => { locked.push(query.sql); return []; },
      table: { findMany: async () => [{ id: valid.sourceTableId }, { id: valid.targetTableId }] },
      order: {
        count: async ({ where }: { where: { tableId: string } }) => {
          assert.match(locked[0], /FROM "Table".*ORDER BY "id" FOR UPDATE/);
          assert.match(locked[1], /FROM "PaymentRequest".*PARTIALLY_MATCHED.*ORDER BY "id" FOR UPDATE/);
          return where.tableId === valid.sourceTableId ? 2 : 0;
        },
        updateMany: async () => ({ count: 2 }),
      },
      tableCheck: { updateMany: async () => ({ count: 1 }) },
      paymentDeferral: { updateMany: async () => ({ count: 0 }) },
      paymentRequest: { updateMany: async ({ where, data }: {
        where: { status: string | { in: string[] } }; data: { tableId: string };
      }) => {
        const statuses = typeof where.status === "string" ? [where.status] : where.status.in;
        if (statuses.includes(payer.status)) payer.tableId = data.tableId;
        return { count: 1 };
      } },
    }),
  });
  await service.transferOpenTableService({ sourceTableId: valid.sourceTableId, targetTableId: valid.targetTableId } as never);
  assert.equal(payer.tableId, valid.targetTableId);
});

const batchInput = {
  batchKey: "batch", tableId: valid.sourceTableId,
  cashier: { id: "cashier", fullName: "Cashier" }, method: "GOLIS",
  lines: [{ payerName: "Guest", payerPhone: "123", amount: 10 }], payLater: false,
};

test("payer creation rechecks the balance after waiting for a table transfer", async () => {
  let moved = false;
  let created = false;
  const readOrders = async () => moved ? [] : [{ total: 10, payments: [] }];
  const service = loadService("src/lib/payments/cashier-payment-requests.ts", {
    order: { findMany: readOrders },
    paymentRequest: { findMany: async () => [] },
    $transaction: async (run: (tx: unknown) => Promise<unknown>) => run({
      $queryRaw: async () => { moved = true; return []; },
      order: { findMany: readOrders },
      paymentRequest: { findMany: async () => [], create: async () => { created = true; return {}; } },
    }),
  });
  await assert.rejects(service.createPaymentRequestBatch(batchInput as never), /no longer has an unpaid balance/);
  assert.equal(created, false);
});

test("payer retry returns a batch created while waiting for the table lock", async () => {
  const existing = [{ id: "payer-1" }];
  const service = loadService("src/lib/payments/cashier-payment-requests.ts", {
    paymentRequest: { findMany: async () => [] },
    $transaction: async (run: (tx: unknown) => Promise<unknown>) => run({
      $queryRaw: async () => [],
      paymentRequest: { findMany: async () => existing },
      order: { findMany: async () => { throw new Error("Existing batch must return before balance validation"); } },
    }),
  });
  assert.equal(await service.createPaymentRequestBatch(batchInput as never), existing);
});

test("locked batch creation persists each payer's selected provider", async () => {
  const saved: Array<{ method: string; expectedAmount: Prisma.Decimal }> = [];
  const service = loadService("src/lib/payments/cashier-payment-requests.ts", {
    paymentRequest: { findMany: async () => [] },
    $transaction: async (run: (tx: unknown) => Promise<unknown>) => run({
      $queryRaw: async () => [],
      order: { findMany: async () => [{ total: 10, payments: [] }] },
      paymentRequest: {
        findMany: async () => [],
        create: async ({ data }: { data: { method: string; expectedAmount: Prisma.Decimal } }) => { saved.push(data); return data; },
      },
    }),
  });
  await service.createPaymentRequestBatch({ ...batchInput, method: undefined, lines: [
    { payerName: "Guest one", payerPhone: "123", amount: 4, method: "GOLIS" },
    { payerName: "Guest two", payerPhone: "456", amount: 6, method: "MYCASH" },
  ] } as never);
  assert.deepEqual(saved.map((row) => [row.method, row.expectedAmount.toFixed(2)]), [["GOLIS", "4.00"], ["MYCASH", "6.00"]]);
});
