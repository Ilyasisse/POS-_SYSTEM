import { createHash, createHmac } from "node:crypto";
import { Prisma, type SupplierOrderRecurrenceUnit } from "@prisma/client";

export const DEFAULT_SUPPLIER_ORDER_TIME_ZONE = "Africa/Nairobi";
export const MAX_ORDER_QUANTITY = new Prisma.Decimal("999999999.999");

const LOCAL_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const QUANTITY_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/;
const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export type ScheduleInput = {
  name: string;
  supplierId: string;
  employeeIds: string[];
  timeZone: string;
  firstInviteAt: Date;
  firstSupplierSendAt: Date;
  reminderIntervalMinutes: number;
  recurrenceUnit: SupplierOrderRecurrenceUnit | null;
  recurrenceInterval: number;
  endAt: Date | null;
  deliveryLeadDays: number;
};

export type EmployeeResponseInput =
  | { noOrder: true; items: [] }
  | {
      noOrder: false;
      items: { catalogItemId: string; quantity: Prisma.Decimal }[];
    };

function formatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

function partsInTimeZone(date: Date, timeZone: string): DateParts {
  const values: Record<string, number> = {};
  for (const part of formatter(timeZone).formatToParts(date)) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  return {
    year: values.year ?? 0,
    month: values.month ?? 0,
    day: values.day ?? 0,
    hour: values.hour ?? 0,
    minute: values.minute ?? 0,
  };
}

function sameParts(left: DateParts, right: DateParts) {
  return Object.keys(left).every(
    (key) => left[key as keyof DateParts] === right[key as keyof DateParts],
  );
}

export function isValidTimeZone(timeZone: string) {
  try {
    formatter(timeZone).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function zonedDateTimeToUtc(value: string, timeZone: string) {
  const match = LOCAL_DATE_TIME_PATTERN.exec(value);
  if (!match || !isValidTimeZone(timeZone)) return null;
  const desired: DateParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
  const wallClockUtc = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hour,
    desired.minute,
  );
  if (
    desired.month < 1 ||
    desired.month > 12 ||
    desired.day < 1 ||
    desired.day > 31 ||
    desired.hour > 23 ||
    desired.minute > 59
  ) {
    return null;
  }

  let candidate = new Date(wallClockUtc);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = partsInTimeZone(candidate, timeZone);
    const actualWallClockUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
    );
    candidate = new Date(candidate.getTime() + wallClockUtc - actualWallClockUtc);
  }
  return sameParts(partsInTimeZone(candidate, timeZone), desired)
    ? candidate
    : null;
}

export function formatDateTimeLocal(date: Date, timeZone: string) {
  const parts = partsInTimeZone(date, timeZone);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function advanceRecurringDate(
  date: Date,
  unit: SupplierOrderRecurrenceUnit,
  interval: number,
  timeZone: string,
) {
  const local = partsInTimeZone(date, timeZone);
  const calendar = new Date(
    Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute),
  );
  if (unit === "DAY") calendar.setUTCDate(calendar.getUTCDate() + interval);
  if (unit === "WEEK") calendar.setUTCDate(calendar.getUTCDate() + 7 * interval);
  if (unit === "MONTH") {
    const anchorDay = calendar.getUTCDate();
    calendar.setUTCDate(1);
    calendar.setUTCMonth(calendar.getUTCMonth() + interval);
    const lastDay = new Date(
      Date.UTC(calendar.getUTCFullYear(), calendar.getUTCMonth() + 1, 0),
    ).getUTCDate();
    calendar.setUTCDate(Math.min(anchorDay, lastDay));
  }
  return zonedDateTimeToUtc(
    `${calendar.getUTCFullYear()}-${String(calendar.getUTCMonth() + 1).padStart(2, "0")}-${String(calendar.getUTCDate()).padStart(2, "0")}T${String(calendar.getUTCHours()).padStart(2, "0")}:${String(calendar.getUTCMinutes()).padStart(2, "0")}`,
    timeZone,
  );
}

export function normalizeE164Phone(value: string) {
  const normalized = value.trim().replace(/[\s()-]/g, "");
  return E164_PATTERN.test(normalized) ? normalized : null;
}

export function isSupplierOrderReminderDue(input: {
  status: "PENDING" | "RESPONDED" | "NO_ORDER";
  invitedAt: Date | null;
  lastReminderAt: Date | null;
  reminderIntervalMinutes: number;
  deadline: Date;
  now: Date;
}) {
  if (
    input.status !== "PENDING" ||
    !input.invitedAt ||
    input.now >= input.deadline
  ) {
    return false;
  }
  const baseline = input.lastReminderAt ?? input.invitedAt;
  return (
    baseline.getTime() + input.reminderIntervalMinutes * 60_000 <=
    input.now.getTime()
  );
}

export function deriveRecipientToken(recipientId: string, secret: string) {
  if (secret.length < 32) {
    throw new Error("SUPPLIER_ORDER_LINK_SECRET must contain at least 32 characters.");
  }
  return createHmac("sha256", secret).update(recipientId).digest("base64url");
}

export function hashRecipientToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function parseEmployeeResponse(input: unknown): EmployeeResponseInput {
  if (!input || typeof input !== "object") {
    throw new Error("Response payload must be an object.");
  }
  const body = input as { noOrder?: unknown; items?: unknown };
  if (body.noOrder === true) return { noOrder: true, items: [] };
  if (body.noOrder !== false || !Array.isArray(body.items)) {
    throw new Error("Choose order items or confirm that no order is needed.");
  }

  const seen = new Set<string>();
  const items = body.items.map((raw) => {
    const item = raw as { catalogItemId?: unknown; quantity?: unknown };
    const catalogItemId = String(item.catalogItemId ?? "").trim();
    const quantityInput = String(item.quantity ?? "").trim();
    if (
      !catalogItemId ||
      seen.has(catalogItemId) ||
      !QUANTITY_PATTERN.test(quantityInput)
    ) {
      throw new Error("Every selected item needs one valid positive quantity.");
    }
    const quantity = new Prisma.Decimal(quantityInput);
    if (quantity.lte(0) || quantity.gt(MAX_ORDER_QUANTITY)) {
      throw new Error("Order quantity is outside the supported range.");
    }
    seen.add(catalogItemId);
    return { catalogItemId, quantity };
  });
  if (items.length === 0) {
    throw new Error("Select at least one item or choose no order needed.");
  }
  return { noOrder: false, items };
}

export function aggregateResponseQuantities(
  items: Iterable<{ catalogItemId: string; quantity: Prisma.Decimal.Value }>,
) {
  const totals = new Map<string, Prisma.Decimal>();
  for (const item of items) {
    totals.set(
      item.catalogItemId,
      (totals.get(item.catalogItemId) ?? new Prisma.Decimal(0)).add(
        item.quantity,
      ),
    );
  }
  return totals;
}

export function expectedDeliveryDate(
  sendAt: Date,
  leadDays: number,
  timeZone = DEFAULT_SUPPLIER_ORDER_TIME_ZONE,
) {
  const local = partsInTimeZone(sendAt, timeZone);
  const date = new Date(Date.UTC(local.year, local.month - 1, local.day));
  date.setUTCDate(date.getUTCDate() + leadDays);
  return new Date(`${date.toISOString().slice(0, 10)}T00:00:00.000Z`);
}
