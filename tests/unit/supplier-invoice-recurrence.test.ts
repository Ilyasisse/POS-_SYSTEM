import { expect, test } from "@jest/globals";

import {
  addSupplierInvoiceCalendarDays,
  advanceSupplierInvoiceRecurrenceDate,
  supplierInvoiceDueOffsetDays,
  validateSupplierInvoiceRecurrenceInput,
} from "../../src/lib/suppliers/invoice-recurrence";

test("validates flexible day, week, and month recurrence intervals", () => {
  const now = new Date("2026-08-09T08:00:00.000Z");
  expect(
    validateSupplierInvoiceRecurrenceInput(
      { interval: "3", unit: "day", nextRunDate: "2026-08-12" },
      now,
    ),
  ).toStrictEqual({
    interval: 3,
    unit: "DAY",
    nextRunDate: new Date("2026-08-12T00:00:00.000Z"),
    anchorDay: null,
  });
  expect(
    validateSupplierInvoiceRecurrenceInput(
      { interval: 2, unit: "MONTH", nextRunDate: "2026-08-31" },
      now,
    ).anchorDay,
  ).toBe(31);
});

test("rejects invalid intervals and past next dates in Nairobi", () => {
  const now = new Date("2026-08-08T22:30:00.000Z");
  for (const interval of [0, 366, 1.5, "abc"]) {
    expect(() =>
      validateSupplierInvoiceRecurrenceInput(
        { interval, unit: "DAY", nextRunDate: "2026-08-10" },
        now,
      ),
    ).toThrow();
  }
  expect(() =>
    validateSupplierInvoiceRecurrenceInput(
      { interval: 1, unit: "WEEK", nextRunDate: "2026-08-08" },
      now,
    ),
  ).toThrow(/cannot be in the past/);
});

test("advances day and week schedules by calendar dates", () => {
  const start = new Date("2026-08-09T00:00:00.000Z");
  expect(advanceSupplierInvoiceRecurrenceDate(start, "DAY", 3, null).toISOString()).toBe(
    "2026-08-12T00:00:00.000Z",
  );
  expect(advanceSupplierInvoiceRecurrenceDate(start, "WEEK", 2, null).toISOString()).toBe(
    "2026-08-23T00:00:00.000Z",
  );
});

test("monthly schedules clamp at month end while preserving the anchor day", () => {
  const january = new Date("2027-01-31T00:00:00.000Z");
  const february = advanceSupplierInvoiceRecurrenceDate(january, "MONTH", 1, 31);
  expect(february.toISOString()).toBe("2027-02-28T00:00:00.000Z");
  expect(advanceSupplierInvoiceRecurrenceDate(february, "MONTH", 1, 31).toISOString()).toBe(
    "2027-03-31T00:00:00.000Z",
  );
  expect(
    advanceSupplierInvoiceRecurrenceDate(
      new Date("2028-01-31T00:00:00.000Z"),
      "MONTH",
      1,
      31,
    ).toISOString(),
  ).toBe("2028-02-29T00:00:00.000Z");
});

test("preserves the invoice-to-due-date offset", () => {
  const invoiceDate = new Date("2026-08-09T00:00:00.000Z");
  const dueDate = new Date("2026-08-14T00:00:00.000Z");
  const offset = supplierInvoiceDueOffsetDays(invoiceDate, dueDate);
  expect(offset).toBe(5);
  expect(
    addSupplierInvoiceCalendarDays(new Date("2026-09-01T00:00:00.000Z"), offset).toISOString(),
  ).toBe("2026-09-06T00:00:00.000Z");
  expect(() => supplierInvoiceDueOffsetDays(dueDate, invoiceDate)).toThrow(/cannot be before/);
});
