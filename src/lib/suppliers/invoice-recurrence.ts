import {
  getSupplierPurchaseTodayDateKey,
  supplierPurchaseDateKeyToDatabaseDate,
} from "@/lib/suppliers/purchase-orders";

export const SUPPLIER_INVOICE_RECURRENCE_UNITS = [
  "DAY",
  "WEEK",
  "MONTH",
] as const;

export type SupplierInvoiceRecurrenceUnitValue =
  (typeof SUPPLIER_INVOICE_RECURRENCE_UNITS)[number];

export type SupplierInvoiceRecurrenceInput = {
  interval: string | number;
  unit: string;
  nextRunDate: string;
};

export type ValidatedSupplierInvoiceRecurrenceInput = {
  interval: number;
  unit: SupplierInvoiceRecurrenceUnitValue;
  nextRunDate: Date;
  anchorDay: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function isRecurrenceUnit(
  value: string,
): value is SupplierInvoiceRecurrenceUnitValue {
  return SUPPLIER_INVOICE_RECURRENCE_UNITS.includes(
    value as SupplierInvoiceRecurrenceUnitValue,
  );
}

export function supplierInvoiceDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function validateSupplierInvoiceRecurrenceInput(
  input: SupplierInvoiceRecurrenceInput,
  now = new Date(),
): ValidatedSupplierInvoiceRecurrenceInput {
  const interval =
    typeof input.interval === "number"
      ? input.interval
      : Number(input.interval.trim());
  if (!Number.isInteger(interval) || interval < 1 || interval > 365) {
    throw new Error("Repeat interval must be a whole number from 1 to 365.");
  }

  const unit = input.unit.trim().toUpperCase();
  if (!isRecurrenceUnit(unit)) {
    throw new Error("Choose days, weeks, or months for the repeat interval.");
  }

  const nextRunDate = supplierPurchaseDateKeyToDatabaseDate(
    input.nextRunDate.trim(),
  );
  if (!nextRunDate) throw new Error("Choose a valid next invoice date.");
  if (supplierInvoiceDateKey(nextRunDate) < getSupplierPurchaseTodayDateKey(now)) {
    throw new Error("The next invoice date cannot be in the past.");
  }

  return {
    interval,
    unit,
    nextRunDate,
    anchorDay: unit === "MONTH" ? nextRunDate.getUTCDate() : null,
  };
}

export function supplierInvoiceDueOffsetDays(
  invoiceDate: Date,
  dueDate: Date,
) {
  const offset = Math.round((dueDate.getTime() - invoiceDate.getTime()) / DAY_MS);
  if (offset < 0) {
    throw new Error(
      "A recurring invoice due date cannot be before its invoice date.",
    );
  }
  return offset;
}

export function addSupplierInvoiceCalendarDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function advanceSupplierInvoiceRecurrenceDate(
  date: Date,
  unit: SupplierInvoiceRecurrenceUnitValue,
  interval: number,
  anchorDay: number | null,
) {
  if (unit === "DAY") {
    return addSupplierInvoiceCalendarDays(date, interval);
  }
  if (unit === "WEEK") {
    return addSupplierInvoiceCalendarDays(date, interval * 7);
  }

  const desiredDay = anchorDay ?? date.getUTCDate();
  const targetMonth = date.getUTCFullYear() * 12 + date.getUTCMonth() + interval;
  const targetYear = Math.floor(targetMonth / 12);
  const targetMonthIndex = targetMonth % 12;
  const lastDay = new Date(
    Date.UTC(targetYear, targetMonthIndex + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(targetYear, targetMonthIndex, Math.min(desiredDay, lastDay)),
  );
}
