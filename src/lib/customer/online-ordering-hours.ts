export type OnlineOrderingSchedule = {
  enabled: boolean;
  startMinute: number;
  endMinute: number;
  timezone: string;
};

export function parseTimeInput(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function formatTimeInput(minuteOfDay: number) {
  const normalized = Math.max(0, Math.min(1439, Math.trunc(minuteOfDay)));
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(
    normalized % 60,
  ).padStart(2, "0")}`;
}

export function getMinuteInTimeZone(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0,
  );
  return hour * 60 + minute;
}

export function isOnlineOrderingOpen(
  schedule: OnlineOrderingSchedule,
  now = new Date(),
) {
  if (!schedule.enabled) return false;
  if (schedule.startMinute === schedule.endMinute) return true;

  const currentMinute = getMinuteInTimeZone(now, schedule.timezone);
  if (schedule.startMinute < schedule.endMinute) {
    return (
      currentMinute >= schedule.startMinute &&
      currentMinute < schedule.endMinute
    );
  }

  return (
    currentMinute >= schedule.startMinute || currentMinute < schedule.endMinute
  );
}

export function describeOnlineOrderingHours(schedule: OnlineOrderingSchedule) {
  if (!schedule.enabled) return "Online ordering is temporarily paused.";
  if (schedule.startMinute === schedule.endMinute) {
    return "Online ordering is open 24 hours.";
  }
  return `Online ordering is available from ${formatTimeInput(
    schedule.startMinute,
  )} to ${formatTimeInput(schedule.endMinute)} (${schedule.timezone}).`;
}
