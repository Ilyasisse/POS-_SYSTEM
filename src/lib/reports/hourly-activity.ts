type HourlyActivity = { hour: string; amount: string; orders: number };

export function rankHourlyActivity(hours: HourlyActivity[]) {
  return [...hours].sort(
    (a, b) =>
      b.orders - a.orders ||
      Number(b.amount) - Number(a.amount) ||
      Number(a.hour) - Number(b.hour),
  );
}
