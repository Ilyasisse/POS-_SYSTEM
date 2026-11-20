import { expect, test } from "@jest/globals";

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
  expect(getSupplierInvoiceDisplayStatus({ status: "DRAFT", bill: null }, now)).toBe("DRAFT");
  expect(getSupplierInvoiceDisplayStatus({ status: "VOID", bill: null }, now)).toBe("VOID");
  expect(getSupplierInvoiceDisplayStatus({ status: "FINALIZED", bill: null }, now)).toBe("PENDING");
  expect(
    getSupplierInvoiceDisplayStatus(
      {
        status: "FINALIZED",
        bill: { status: "UNPAID", dueDate: dueDate("2026-07-25") },
      },
      now,
    ),
  ).toBe("PENDING");
  expect(
    getSupplierInvoiceDisplayStatus(
      {
        status: "FINALIZED",
        bill: { status: "UNPAID", dueDate: dueDate("2026-07-24") },
      },
      now,
    ),
  ).toBe("PENDING");
  expect(
    getSupplierInvoiceDisplayStatus(
      {
        status: "FINALIZED",
        bill: { status: "PARTIAL", dueDate: dueDate("2026-07-25") },
      },
      now,
    ),
  ).toBe("PARTIALLY_PAID");
  expect(
    getSupplierInvoiceDisplayStatus(
      {
        status: "FINALIZED",
        bill: { status: "PARTIAL", dueDate: dueDate("2026-07-24") },
      },
      now,
    ),
  ).toBe("PARTIALLY_PAID");
  expect(
    getSupplierInvoiceDisplayStatus(
      {
        status: "FINALIZED",
        bill: { status: "UNPAID", dueDate: dueDate("2026-07-23") },
      },
      now,
    ),
  ).toBe("OVERDUE");
  expect(
    getSupplierInvoiceDisplayStatus(
      {
        status: "FINALIZED",
        bill: { status: "PARTIAL", dueDate: dueDate("2026-07-23") },
      },
      now,
    ),
  ).toBe("OVERDUE");
  expect(
    getSupplierInvoiceDisplayStatus(
      {
        status: "FINALIZED",
        bill: { status: "PAID", dueDate: dueDate("2026-07-23") },
      },
      now,
    ),
  ).toBe("PAID");
});

test("uses Nairobi day boundaries for invoice payment status", () => {
  const beforeNairobiMidnight = new Date("2026-07-24T20:59:59.000Z");
  const afterNairobiMidnight = new Date("2026-07-24T21:00:01.000Z");
  const bill = {
    status: "UNPAID" as const,
    dueDate: dueDate("2026-07-24"),
  };

  expect(
    getSupplierInvoiceDisplayStatus({ status: "FINALIZED", bill }, beforeNairobiMidnight),
  ).toBe("PENDING");
  expect(getSupplierInvoiceDisplayStatus({ status: "FINALIZED", bill }, afterNairobiMidnight)).toBe(
    "OVERDUE",
  );
});

test("defines labels for every selectable invoice display status", () => {
  expect(SUPPLIER_INVOICE_DISPLAY_STATUSES).toStrictEqual([
    "DRAFT",
    "PENDING",
    "PARTIALLY_PAID",
    "OVERDUE",
    "PAID",
    "VOID",
  ]);
  expect(SUPPLIER_INVOICE_DISPLAY_STATUS_LABELS.PARTIALLY_PAID).toBe("PARTIALLY PAID");
});

test("builds database filters for every display status", () => {
  expect(getSupplierInvoiceDisplayStatusWhere("DRAFT", now)).toStrictEqual({
    status: "DRAFT",
  });
  expect(getSupplierInvoiceDisplayStatusWhere("VOID", now)).toStrictEqual({
    status: "VOID",
  });
  expect(getSupplierInvoiceDisplayStatusWhere("PAID", now)).toStrictEqual({
    status: "FINALIZED",
    bill: { is: { status: "PAID" } },
  });
  expect(getSupplierInvoiceDisplayStatusWhere("OVERDUE", now)).toStrictEqual({
    status: "FINALIZED",
    bill: {
      is: {
        status: { in: ["UNPAID", "PARTIAL"] },
        dueDate: { lt: dueDate("2026-07-24") },
      },
    },
  });
  expect(getSupplierInvoiceDisplayStatusWhere("PARTIALLY_PAID", now)).toStrictEqual({
    status: "FINALIZED",
    bill: {
      is: {
        status: "PARTIAL",
        dueDate: { gte: dueDate("2026-07-24") },
      },
    },
  });
  expect(getSupplierInvoiceDisplayStatusWhere("PENDING", now)).toStrictEqual({
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
