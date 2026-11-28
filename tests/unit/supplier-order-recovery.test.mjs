import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { after } from "node:test";
import { Prisma } from "@prisma/client";

const now = new Date("2026-10-02T12:00:00.000Z");
const state = { runs: [], orders: [], claims: [], beforeClaim: null };

function matches(run, where) {
  if (where.id && run.id !== where.id) return false;
  if (where.schedule?.deletedAt === null && run.schedule.deletedAt !== null)
    return false;
  if (typeof where.status === "string" && run.status !== where.status)
    return false;
  if (where.status?.in && !where.status.in.includes(run.status)) return false;
  if (where.purchaseOrderId === null && run.purchaseOrderId !== null)
    return false;
  if (where.updatedAt?.lte && run.updatedAt > where.updatedAt.lte) return false;
  if (
    where.supplierSendAt?.lte &&
    run.supplierSendAt > where.supplierSendAt.lte
  )
    return false;
  return !where.OR || where.OR.some((condition) => matches(run, condition));
}

const tx = {
  supplierOrderRun: {
    async findFirst({ where }) {
      return state.runs.find((run) => matches(run, where)) ?? null;
    },
    async update({ where, data }) {
      const run = state.runs.find((row) => row.id === where.id);
      Object.assign(run, data, { updatedAt: now });
      return run;
    },
  },
  supplierCatalogItem: {
    async findMany() {
      return [
        {
          id: "milk",
          unit: "crate",
          unitPrice: new Prisma.Decimal("10"),
          product: { name: "Milk", isActive: true },
          inventorySupply: null,
        },
      ];
    },
  },
  supplierPurchaseOrder: {
    async create({ data }) {
      const order = { id: `order-${state.orders.length + 1}`, ...data };
      state.orders.push(order);
      return order;
    },
  },
};
globalThis.supplierOrderTestPrisma = {
  supplierOrderSchedule: {
    async findMany() {
      return [];
    },
  },
  supplierOrderRun: {
    async findMany({ where, include }) {
      // The regression exercises finalization; invitation and delivery are isolated.
      if (include?.recipients || include?.purchaseOrder) return [];
      return state.runs
        .filter((run) => matches(run, where))
        .map(({ id }) => ({ id }));
    },
    async updateMany({ where, data }) {
      state.beforeClaim?.();
      state.beforeClaim = null;
      const runs = state.runs.filter((run) => matches(run, where));
      for (const run of runs) {
        state.claims.push(run.id);
        Object.assign(run, data, { updatedAt: now });
      }
      return { count: runs.length };
    },
    update: tx.supplierOrderRun.update,
  },
  async $transaction(operation) {
    return operation(tx);
  },
};

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/prisma") {
      return {
        url: new URL("../helpers/supplier-order-runtime.cjs", import.meta.url)
          .href,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});
const { processScheduledSupplierOrders } =
  await import("../../src/lib/supplier-orders/service.ts");
hooks.deregister();
delete globalThis.supplierOrderTestPrisma;

const previousEnabled = process.env.TWILIO_WHATSAPP_ENABLED;
process.env.TWILIO_WHATSAPP_ENABLED = "true";
after(() => {
  if (previousEnabled === undefined) delete process.env.TWILIO_WHATSAPP_ENABLED;
  else process.env.TWILIO_WHATSAPP_ENABLED = previousEnabled;
});

function run(overrides = {}) {
  return {
    id: "interrupted-run",
    status: "FINALIZING",
    purchaseOrderId: null,
    updatedAt: new Date(now.getTime() - 181_000),
    supplierId: "supplier-1",
    supplierSendAt: new Date(now.getTime() - 300_000),
    timeZone: "Africa/Nairobi",
    deliveryLeadDays: 1,
    schedule: {
      deletedAt: null,
      createdByUserId: "staff-1",
      name: "Milk order",
    },
    recipients: [
      {
        invitedAt: new Date(now.getTime() - 600_000),
        responseItems: [
          { supplierCatalogItemId: "milk", quantity: new Prisma.Decimal("2") },
        ],
      },
    ],
    ...overrides,
  };
}
function reset(runs) {
  state.runs = runs;
  state.orders = [];
  state.claims = [];
  state.beforeClaim = null;
}

test("recovers an interrupted finalization after its scheduler lease has expired", async () => {
  reset([run()]);
  const result = await processScheduledSupplierOrders(now);
  assert.equal(result.finalized.created, 1);
  assert.equal(state.orders.length, 1);
  assert.equal(state.runs[0].purchaseOrderId, "order-1");
  assert.equal(state.orders[0].items.create[0].quantity.toString(), "2");
  assert.equal(state.orders[0].totalAmount.toString(), "20");

  await processScheduledSupplierOrders(now);
  assert.equal(
    state.orders.length,
    1,
    "recovery must not create a second purchase order",
  );
});

test("does not reclaim a finalization that could still be running", async () => {
  reset([run({ updatedAt: new Date(now.getTime() - 1_000) })]);
  const result = await processScheduledSupplierOrders(now);
  assert.equal(result.finalized.created, 0);
  assert.equal(state.orders.length, 0);
  assert.equal(state.claims.length, 0);
});

test("rechecks recovery eligibility atomically when claiming a listed run", async () => {
  reset([run()]);
  state.beforeClaim = () => {
    state.runs[0].updatedAt = now;
  };
  const result = await processScheduledSupplierOrders(now);
  assert.equal(result.finalized.created, 0);
  assert.equal(state.orders.length, 0);
  assert.equal(state.claims.length, 0);
});

test("does not recover completed, deleted, or future runs", async () => {
  reset([
    run({ id: "already-finalized", purchaseOrderId: "existing-order" }),
    run({ id: "deleted", schedule: { deletedAt: now } }),
    run({ id: "future", supplierSendAt: new Date(now.getTime() + 60_000) }),
  ]);
  const result = await processScheduledSupplierOrders(now);
  assert.equal(result.finalized.created, 0);
  assert.equal(state.claims.length, 0);
});

test("still finalizes ordinary collecting runs immediately at the deadline", async () => {
  reset([run({ status: "COLLECTING", updatedAt: now })]);
  const result = await processScheduledSupplierOrders(now);
  assert.equal(result.finalized.created, 1);
  assert.equal(state.orders.length, 1);
});
