const businessDayDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const businessDayTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

export function getCashierBusinessDayRange(now: Date = new Date()) {
  const start = new Date(now);
  const end = new Date(now);
  const currentHour = now.getHours();

  if (currentHour >= 7) {
    start.setHours(7, 0, 0, 0);
    end.setDate(end.getDate() + 1);
    end.setHours(5, 0, 0, 0);
    return { start, end };
  }

  if (currentHour < 5) {
    start.setDate(start.getDate() - 1);
    start.setHours(7, 0, 0, 0);
    end.setHours(5, 0, 0, 0);
    return { start, end };
  }

  start.setHours(7, 0, 0, 0);
  end.setDate(end.getDate() + 1);
  end.setHours(5, 0, 0, 0);

  return { start, end };
}

export function formatCashierBusinessDayRange(start: Date, end: Date) {
  return `${businessDayDateFormatter.format(start)} ${businessDayTimeFormatter.format(start)} to ${businessDayDateFormatter.format(end)} ${businessDayTimeFormatter.format(end)}`;
}
