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

export function getNextCashierBusinessDayResetAt(now: Date = new Date()) {
  const resetAt = new Date(now);
  const currentHour = now.getHours();

  if (currentHour < 5) {
    resetAt.setHours(5, 0, 0, 0);
    return resetAt;
  }

  if (currentHour < 7) {
    resetAt.setHours(7, 0, 0, 0);
    return resetAt;
  }

  resetAt.setDate(resetAt.getDate() + 1);
  resetAt.setHours(5, 0, 0, 0);
  return resetAt;
}

export function formatCashierBusinessDayRange(start: Date, end: Date) {
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });

  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${dateFormatter.format(start)} ${timeFormatter.format(start)} to ${dateFormatter.format(end)} ${timeFormatter.format(end)}`;
}
