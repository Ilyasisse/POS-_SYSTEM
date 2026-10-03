import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { buildActiveWaiterShiftWhere } from "../../src/lib/waiter/waiter-shift-gate";

type Shift = { businessDate: Date | null; openedAt: Date; closedAt: Date | null };

async function dispatchFixture(now: Date, shifts: Shift[]) {
  let assignedWaiter: string | null | undefined;
  let auditedAction: string | undefined;
  let queriedShift: Record<string, unknown> | undefined;
  const exports: Record<string, (tx: unknown, input: unknown) => Promise<void>> = {};
  const output = ts.transpileModule(
    readFileSync("src/lib/staff/customer-order-dispatch.ts", "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  class FixedDate extends Date {
    constructor(value?: string | number) { super(value ?? now.getTime()); }
  }
  vm.runInNewContext(output, {
    exports,
    Date: FixedDate,
    require: () => ({ buildActiveWaiterShiftWhere }),
  });
  const tx = {
    staff: {
      findFirst: async ({ where }: { where: { role: string; shifts?: { some: Record<string, unknown> } } }) => {
        if (where.role !== "WAITER") return null;
        const filter = where.shifts!.some;
        queriedShift = filter;
        const found = shifts.some(shift => {
          if (shift.closedAt !== null || filter.userId !== undefined) return false;
          if (filter.businessDate instanceof Date) {
            return shift.businessDate?.getTime() === filter.businessDate.getTime();
          }
          const range = filter.openedAt as { gte: Date; lt: Date };
          return shift.openedAt >= range.gte && shift.openedAt < range.lt;
        });
        return found ? { id: "waiter" } : null;
      },
    },
    order: {
      update: async ({ data }: { data: { waiterId: string | null } }) => { assignedWaiter = data.waiterId; },
    },
    auditLog: {
      create: async ({ data }: { data: { action: string } }) => { auditedAction = data.action; },
    },
  };
  await exports.dispatchCustomerOrder(tx, { orderId: "order", orderNumber: 1, customerId: "customer", tableName: null });
  return { assignedWaiter, auditedAction, queriedShift };
}

test("customer routing honors the current waiter business date regardless of shift creation time", async () => {
  const result = await dispatchFixture(new Date("2026-07-01T09:00:00Z"), [{
    businessDate: new Date("2026-07-01T00:00:00Z"),
    openedAt: new Date("2026-06-30T09:00:00Z"), closedAt: null,
  }]);
  assert.equal(result.assignedWaiter, "waiter");
  assert.equal(result.auditedAction, "customer_order.assigned");
  assert.equal(result.queriedShift?.openedAt, undefined);
});

test("customer routing ignores closed or older business-date shifts", async () => {
  for (const shift of [
    { businessDate: new Date("2026-06-30T00:00:00Z"), openedAt: new Date("2026-07-01T09:00:00Z"), closedAt: null },
    { businessDate: new Date("2026-07-01T00:00:00Z"), openedAt: new Date("2026-07-01T09:00:00Z"), closedAt: new Date("2026-07-01T10:00:00Z") },
  ]) {
    const result = await dispatchFixture(new Date("2026-07-01T12:00:00Z"), [shift]);
    assert.equal(result.assignedWaiter, null);
    assert.equal(result.auditedAction, "customer_order.unassigned");
  }
});

test("legacy customer routing still uses the shift opening-time window before ledger activation", async () => {
  const result = await dispatchFixture(new Date("2026-06-30T09:00:00Z"), [{
    businessDate: null, openedAt: new Date("2026-06-30T08:00:00Z"), closedAt: null,
  }]);
  assert.equal(result.assignedWaiter, "waiter");
  assert.equal(result.queriedShift?.businessDate, undefined);
});
