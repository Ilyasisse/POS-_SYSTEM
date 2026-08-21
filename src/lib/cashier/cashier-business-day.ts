export const CASHIER_BUSINESS_TIME_ZONE = "Africa/Nairobi";

type BusinessDayDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const businessDayPartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CASHIER_BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const businessDayDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CASHIER_BUSINESS_TIME_ZONE,
  month: "short",
  day: "numeric",
});

const businessDayTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CASHIER_BUSINESS_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

function getBusinessDayDateParts(date: Date): BusinessDayDateParts {
  const values: Record<string, number> = {};

  for (const part of businessDayPartsFormatter.formatToParts(date)) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }

  return {
    year: values.year ?? 0,
    month: values.month ?? 0,
    day: values.day ?? 0,
    hour: values.hour ?? 0,
    minute: values.minute ?? 0,
    second: values.second ?? 0,
  };
}

function businessDateAtHour(
  date: Pick<BusinessDayDateParts, "year" | "month" | "day">,
  hour: number,
) {
  const desiredWallClock = Date.UTC(
    date.year,
    date.month - 1,
    date.day,
    hour,
  );
  let candidate = new Date(desiredWallClock);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = getBusinessDayDateParts(candidate);
    const actualWallClock = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    candidate = new Date(
      candidate.getTime() + desiredWallClock - actualWallClock,
    );
  }

  return candidate;
}

export function getCashierBusinessDayRange(now: Date = new Date()) {
  const current = getBusinessDayDateParts(now);
  const businessDate = new Date(
    Date.UTC(current.year, current.month - 1, current.day),
  );

  if (current.hour < 7) {
    businessDate.setUTCDate(businessDate.getUTCDate() - 1);
  }

  const startDate = {
    year: businessDate.getUTCFullYear(),
    month: businessDate.getUTCMonth() + 1,
    day: businessDate.getUTCDate(),
  };
  businessDate.setUTCDate(businessDate.getUTCDate() + 1);
  const endDate = {
    year: businessDate.getUTCFullYear(),
    month: businessDate.getUTCMonth() + 1,
    day: businessDate.getUTCDate(),
  };
  const start = businessDateAtHour(startDate, 7);
  const end = businessDateAtHour(endDate, 5);

  return { start, end };
}

export function formatCashierBusinessDayRange(start: Date, end: Date) {
  return `${businessDayDateFormatter.format(start)} ${businessDayTimeFormatter.format(start)} to ${businessDayDateFormatter.format(end)} ${businessDayTimeFormatter.format(end)}`;
}
