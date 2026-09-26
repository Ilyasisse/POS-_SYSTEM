export function parseLaborMonth(
  raw: string,
  current: string,
): {
  month: string;
  start: Date;
  end: Date;
} {
  const valid = /^(20\d{2})-(0[1-9]|1[0-2])$/.exec(raw);
  const month = valid && raw <= current ? raw : current;
  const [year, number] = month.split("-").map(Number);
  return {
    month,
    start: new Date(Date.UTC(year, number - 1, 1)),
    end: new Date(Date.UTC(year, number, 1)),
  };
}

export function currentCafeMonth(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

export function formatWorkMinutes(minutes: number): string {
  const safe = Math.max(0, Math.trunc(minutes));
  return `${Math.floor(safe / 60)}h ${String(safe % 60).padStart(2, "0")}m`;
}
