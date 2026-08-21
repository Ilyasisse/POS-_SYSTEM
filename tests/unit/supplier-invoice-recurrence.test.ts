import assert from "node:assert/strict";
import test from "node:test";
import {
  addSupplierInvoiceCalendarDays,
  advanceSupplierInvoiceRecurrenceDate,
  supplierInvoiceDueOffsetDays,
  validateSupplierInvoiceRecurrenceInput,
} from "../../src/lib/suppliers/invoice-recurrence";

test("validates flexible day, week, and month recurrence intervals", () => {
  const now = new Date("2026-08-09T08:00:00.000Z");
  assert.deepEqual(
    validateSupplierInvoiceRecurrenceInput(
      { interval: "3", unit: "day", nextRunDate: "2026-08-12" },
      now,
    ),
    {
      interval: 3,
      unit: "DAY",
      nextRunDate: new Date("2026-08-12T00:00:00.000Z"),
      anchorDay: null,
    },
  );
  assert.equal(
    validateSupplierInvoiceRecurrenceInput(
      { interval: 2, unit: "MONTH", nextRunDate: "2026-08-31" },
      now,
    ).anchorDay,
    31,
  );
});

test("rejects invalid intervals and past next dates in Nairobi", () => {
  const now = new Date("2026-08-08T22:30:00.000Z");
  for (const interval of [0, 366, 1.5, "abc"]) {
    assert.throws(() =>
      validateSupplierInvoiceRecurrenceInput(
        { interval, unit: "DAY", nextRunDate: "2026-08-10" },
        now,
      ),
    );
  }
  assert.throws(
    () =>
      validateSupplierInvoiceRecurrenceInput(
        { interval: 1, unit: "WEEK", nextRunDate: "2026-08-08" },
        now,
      ),
    /cannot be in the past/,
  );
});

test("advances day and week schedules by calendar dates", () => {
  const start = new Date("2026-08-09T00:00:00.000Z");
  assert.equal(
    advanceSupplierInvoiceRecurrenceDate(start, "DAY", 3, null).toISOString(),
    "2026-08-12T00:00:00.000Z",
  );
  assert.equal(
    advanceSupplierInvoiceRecurrenceDate(start, "WEEK", 2, null).toISOString(),
    "2026-08-23T00:00:00.000Z",
  );
});

test("monthly schedules clamp at month end while preserving the anchor day", () => {
  const january = new Date("2027-01-31T00:00:00.000Z");
  const february = advanceSupplierInvoiceRecurrenceDate(
    january,
    "MONTH",
    1,
    31,
  );
  assert.equal(february.toISOString(), "2027-02-28T00:00:00.000Z");
  assert.equal(
    advanceSupplierInvoiceRecurrenceDate(
      february,
      "MONTH",
      1,
      31,
    ).toISOString(),
    "2027-03-31T00:00:00.000Z",
  );
  assert.equal(
    advanceSupplierInvoiceRecurrenceDate(
      new Date("2028-01-31T00:00:00.000Z"),
      "MONTH",
      1,
      31,
    ).toISOString(),
    "2028-02-29T00:00:00.000Z",
  );
});

test("preserves the invoice-to-due-date offset", () => {
  const invoiceDate = new Date("2026-08-09T00:00:00.000Z");
  const dueDate = new Date("2026-08-14T00:00:00.000Z");
  const offset = supplierInvoiceDueOffsetDays(invoiceDate, dueDate);
  assert.equal(offset, 5);
  assert.equal(
    addSupplierInvoiceCalendarDays(
      new Date("2026-09-01T00:00:00.000Z"),
      offset,
    ).toISOString(),
    "2026-09-06T00:00:00.000Z",
  );
  assert.throws(
    () => supplierInvoiceDueOffsetDays(dueDate, invoiceDate),
    /cannot be before/,
  );
});
