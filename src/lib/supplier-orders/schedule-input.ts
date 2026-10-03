import type { SupplierOrderRecurrenceUnit } from "@prisma/client";
import {
  DEFAULT_SUPPLIER_ORDER_TIME_ZONE,
  isValidTimeZone,
  type ScheduleInput,
  zonedDateTimeToUtc,
} from "./scheduling";

export type SupplierOrderScheduleFieldInput = {
  name: string;
  supplierId: string;
  timeZone: string;
  firstInviteAt: string;
  firstSupplierSendAt: string;
  reminderIntervalMinutes: string;
  recurrenceUnit: string;
  recurrenceInterval: string;
  endAt: string;
  deliveryLeadDays: string;
  employeeIds: string[];
};

function wholeNumber(
  value: string,
  minimum: number,
  maximum: number,
  message: string,
) {
  const trimmed = value.trim();
  const number = trimmed ? Number(trimmed) : Number.NaN;
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new Error(message);
  }
  return number;
}

export function validateSupplierOrderScheduleFields(
  input: SupplierOrderScheduleFieldInput,
  now = new Date(),
): ScheduleInput {
  const name = input.name.trim();
  const timeZone = input.timeZone.trim() || DEFAULT_SUPPLIER_ORDER_TIME_ZONE;
  if (name.length < 2 || name.length > 120) {
    throw new Error("Enter a schedule name between 2 and 120 characters.");
  }
  if (!isValidTimeZone(timeZone))
    throw new Error("Enter a valid IANA timezone.");

  const firstInviteAt = zonedDateTimeToUtc(
    input.firstInviteAt.trim(),
    timeZone,
  );
  const firstSupplierSendAt = zonedDateTimeToUtc(
    input.firstSupplierSendAt.trim(),
    timeZone,
  );
  if (
    !firstInviteAt ||
    !firstSupplierSendAt ||
    firstSupplierSendAt <= firstInviteAt
  ) {
    throw new Error(
      "Supplier send time must be after the employee invitation time.",
    );
  }
  if (firstInviteAt.getTime() < now.getTime() - 60_000) {
    throw new Error("The first invitation time cannot be in the past.");
  }

  const endValue = input.endAt.trim();
  const endAt = endValue ? zonedDateTimeToUtc(endValue, timeZone) : null;
  if (endValue && !endAt) throw new Error("Enter a valid recurrence end time.");
  if (endAt && endAt < firstInviteAt) {
    throw new Error("The end time cannot be before the first invitation.");
  }

  const recurrenceValue = input.recurrenceUnit.trim();
  if (recurrenceValue && !["DAY", "WEEK", "MONTH"].includes(recurrenceValue)) {
    throw new Error("Choose a valid recurrence interval unit.");
  }
  const recurrenceUnit = (recurrenceValue ||
    null) as SupplierOrderRecurrenceUnit | null;
  const reminderIntervalMinutes = wholeNumber(
    input.reminderIntervalMinutes,
    5,
    10080,
    "Reminder interval must be between 5 and 10,080 minutes.",
  );
  const recurrenceInterval = recurrenceUnit
    ? wholeNumber(
        input.recurrenceInterval,
        1,
        365,
        "Recurrence interval must be between 1 and 365.",
      )
    : 1;
  const deliveryLeadDays = wholeNumber(
    input.deliveryLeadDays,
    0,
    365,
    "Delivery lead days must be between 0 and 365.",
  );
  const employeeIds = [
    ...new Set(input.employeeIds.map((id) => id.trim()).filter(Boolean)),
  ];
  if (!employeeIds.length) throw new Error("Choose at least one employee.");

  return {
    name,
    supplierId: input.supplierId.trim(),
    employeeIds,
    timeZone,
    firstInviteAt,
    firstSupplierSendAt,
    reminderIntervalMinutes,
    recurrenceUnit,
    recurrenceInterval,
    endAt,
    deliveryLeadDays,
  };
}
