import assert from "node:assert/strict";
import test from "node:test";
import {
  type SupplierOrderScheduleFieldInput,
  validateSupplierOrderScheduleFields,
} from "../../src/lib/supplier-orders/schedule-input";
import {
  advanceRecurringDate,
  formatDateTimeLocal,
  zonedDateTimeToUtc,
} from "../../src/lib/supplier-orders/scheduling";

const now = new Date("2026-01-01T00:00:00.000Z");
const fields: SupplierOrderScheduleFieldInput = {
  name: "Monthly supplies",
  supplierId: "supplier-1",
  timeZone: "Africa/Nairobi",
  firstInviteAt: "2026-01-31T09:00",
  firstSupplierSendAt: "2026-01-31T17:00",
  reminderIntervalMinutes: "60",
  recurrenceUnit: "MONTH",
  recurrenceInterval: "1",
  endAt: "2026-12-31T23:00",
  deliveryLeadDays: "1",
  employeeIds: ["employee-1"],
};

test("validates schedule fields without changing whole-number intervals", () => {
  const result = validateSupplierOrderScheduleFields(fields, now);
  assert.equal(result.firstInviteAt.toISOString(), "2026-01-31T06:00:00.000Z");
  assert.equal(result.recurrenceInterval, 1);
  assert.equal(result.reminderIntervalMinutes, 60);
  assert.equal(result.deliveryLeadDays, 1);
  assert.equal(result.endAt?.toISOString(), "2026-12-31T20:00:00.000Z");
});

test("rejects fractional and partially numeric schedule intervals", () => {
  for (const key of [
    "reminderIntervalMinutes",
    "recurrenceInterval",
    "deliveryLeadDays",
  ] as const) {
    for (const value of ["5.5", "5minutes", "", "Infinity"]) {
      assert.throws(
        () =>
          validateSupplierOrderScheduleFields({ ...fields, [key]: value }, now),
        /interval must be|lead days must be/,
      );
    }
  }
});

test("rejects malformed recurrence end dates instead of removing the end", () => {
  for (const endAt of ["not-a-date", "2026-02-30T09:00"]) {
    assert.throws(
      () => validateSupplierOrderScheduleFields({ ...fields, endAt }, now),
      /valid recurrence end time/,
    );
  }
  assert.equal(
    validateSupplierOrderScheduleFields({ ...fields, endAt: "" }, now).endAt,
    null,
  );
});

test("rejects invalid recurrence units instead of saving a one-time schedule", () => {
  assert.throws(
    () =>
      validateSupplierOrderScheduleFields(
        { ...fields, recurrenceUnit: "YEAR" },
        now,
      ),
    /valid recurrence interval unit/,
  );
  assert.equal(
    validateSupplierOrderScheduleFields({ ...fields, recurrenceUnit: "" }, now)
      .recurrenceUnit,
    null,
  );
});

test("monthly invitations and supplier sends return to their original day after February", () => {
  for (const initial of ["2026-01-30T09:00", "2026-01-31T17:00"]) {
    const anchor = zonedDateTimeToUtc(initial, "Africa/Nairobi") as Date;
    const february = advanceRecurringDate(
      anchor,
      "MONTH",
      1,
      "Africa/Nairobi",
      anchor,
    ) as Date;
    const march = advanceRecurringDate(
      february,
      "MONTH",
      1,
      "Africa/Nairobi",
      anchor,
    ) as Date;
    assert.equal(
      formatDateTimeLocal(february, "Africa/Nairobi"),
      initial.replace("01-30", "02-28").replace("01-31", "02-28"),
    );
    assert.equal(
      formatDateTimeLocal(march, "Africa/Nairobi"),
      initial.replace("2026-01", "2026-03"),
    );
  }
});
