import assert from "node:assert/strict";
import test from "node:test";

import {
  getSupplierInvoiceDisplayStatus,
  getSupplierInvoiceDisplayStatusWhere,
  SUPPLIER_INVOICE_DISPLAY_STATUS_LABELS,
  SUPPLIER_INVOICE_DISPLAY_STATUSES,
} from "../../src/lib/suppliers/invoice-status";
import { supplierPurchaseDateKeyToDatabaseDate } from "../../src/lib/suppliers/purchase-orders";

const now = new Date("2026-07-24T12:00:00.000Z");

function dueDate(dateKey: string) {
  const value = supplierPurchaseDateKeyToDatabaseDate(dateKey);
  if (!value) throw new Error(`Invalid test date: ${dateKey}`);
  return value;
}

test("derives every supplier invoice display status", () => {
  assert.equal(
    getSupplierInvoiceDisplayStatus({ status: "DRAFT", bill: null }, now),
    "DRAFT",
  );
  assert.equal(
    getSupplierInvoiceDisplayStatus({ status: "VOID", bill: null }, now),
    "VOID",
  );
  assert.equal(
    getSupplierInvoiceDisplayStatus({ status: "FINALIZED", bill: null }, now),
    "PENDING",
  );
  assert.equal(
    getSupplierInvoiceDisplayStatus(
      {
        status: "FINALIZED",
        bill: { status: "UNPAID", dueDate: dueDate("2026-07-25") },
      },
      now,
    ),
    "PENDING",
  );
  assert.equal(
    getSupplierInvoiceDisplayStatus(
      {
        status: "FINALIZED",
        bill: { status: "UNPAID", dueDate: dueDate("2026-07-24") },
      },
      now,
    ),
    "PENDING",
  );
  assert.equal(
    getSupplierInvoiceDisplayStatus(
      {
        status: "FINALIZED",
        bill: { status: "PARTIAL", dueDate: dueDate("2026-07-25") },
      },
      now,
    ),
    "PARTIALLY_PAID",
  );
  assert.equal(
    getSupplierInvoiceDisplayStatus(
      {
        status: "FINALIZED",
        bill: { status: "PARTIAL", dueDate: dueDate("2026-07-24") },
      },
      now,
    ),
    "PARTIALLY_PAID",
  );
  assert.equal(
    getSupplierInvoiceDisplayStatus(
      {
        status: "FINALIZED",
        bill: { status: "UNPAID", dueDate: dueDate("2026-07-23") },
      },
      now,
    ),
    "OVERDUE",
  );
  assert.equal(
    getSupplierInvoiceDisplayStatus(
      {
        status: "FINALIZED",
        bill: { status: "PARTIAL", dueDate: dueDate("2026-07-23") },
      },
      now,
    ),
    "OVERDUE",
  );
  assert.equal(
    getSupplierInvoiceDisplayStatus(
      {
        status: "FINALIZED",
        bill: { status: "PAID", dueDate: dueDate("2026-07-23") },
      },
      now,
    ),
    "PAID",
  );
});

test("uses Nairobi day boundaries for invoice payment status", () => {
  const beforeNairobiMidnight = new Date("2026-07-24T20:59:59.000Z");
  const afterNairobiMidnight = new Date("2026-07-24T21:00:01.000Z");
  const bill = {
    status: "UNPAID" as const,
    dueDate: dueDate("2026-07-24"),
  };

  assert.equal(
    getSupplierInvoiceDisplayStatus(
      { status: "FINALIZED", bill },
      beforeNairobiMidnight,
    ),
    "PENDING",
  );
  assert.equal(
    getSupplierInvoiceDisplayStatus(
      { status: "FINALIZED", bill },
      afterNairobiMidnight,
    ),
    "OVERDUE",
  );
});

test("defines labels for every selectable invoice display status", () => {
  assert.deepEqual(SUPPLIER_INVOICE_DISPLAY_STATUSES, [
    "DRAFT",
    "PENDING",
    "PARTIALLY_PAID",
    "OVERDUE",
    "PAID",
    "VOID",
  ]);
  assert.equal(
    SUPPLIER_INVOICE_DISPLAY_STATUS_LABELS.PARTIALLY_PAID,
    "PARTIALLY PAID",
  );
});

test("builds database filters for every display status", () => {
  assert.deepEqual(getSupplierInvoiceDisplayStatusWhere("DRAFT", now), {
    status: "DRAFT",
  });
  assert.deepEqual(getSupplierInvoiceDisplayStatusWhere("VOID", now), {
    status: "VOID",
  });
  assert.deepEqual(getSupplierInvoiceDisplayStatusWhere("PAID", now), {
    status: "FINALIZED",
    bill: { is: { status: "PAID" } },
  });
  assert.deepEqual(getSupplierInvoiceDisplayStatusWhere("OVERDUE", now), {
    status: "FINALIZED",
    bill: {
      is: {
        status: { in: ["UNPAID", "PARTIAL"] },
        dueDate: { lt: dueDate("2026-07-24") },
      },
    },
  });
  assert.deepEqual(getSupplierInvoiceDisplayStatusWhere("PARTIALLY_PAID", now), {
    status: "FINALIZED",
    bill: {
      is: {
        status: "PARTIAL",
        dueDate: { gte: dueDate("2026-07-24") },
      },
    },
  });
  assert.deepEqual(getSupplierInvoiceDisplayStatusWhere("PENDING", now), {
    status: "FINALIZED",
    OR: [
      {
        bill: {
          is: {
            status: "UNPAID",
            dueDate: { gte: dueDate("2026-07-24") },
          },
        },
      },
      { bill: { is: null } },
    ],
  });
});
