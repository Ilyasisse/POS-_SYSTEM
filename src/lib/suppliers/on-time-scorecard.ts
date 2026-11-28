export type SupplierDeliveryRecord = {
  supplierId: string;
  supplierName: string;
  expectedDeliveryDate: Date;
  receivedAt: Date | null;
};

const cafeDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "Africa/Nairobi",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function dateInCafe(date: Date) {
  const parts = Object.fromEntries(
    cafeDate.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function isDeliveryOnTime(expected: Date, received: Date) {
  // Date-only columns are stored as UTC midnight; do not shift the expected
  // date into a different time zone. Arrival is a timestamp in café time.
  return dateInCafe(received) <= expected.toISOString().slice(0, 10);
}

export function summarizeSupplierDeliveries(
  rows: readonly SupplierDeliveryRecord[],
) {
  const result = new Map<
    string,
    {
      supplierId: string;
      name: string;
      onTime: number;
      late: number;
      notRecorded: number;
    }
  >();
  for (const row of rows) {
    const current = result.get(row.supplierId) ?? {
      supplierId: row.supplierId,
      name: row.supplierName,
      onTime: 0,
      late: 0,
      notRecorded: 0,
    };
    if (!row.receivedAt) current.notRecorded += 1;
    else if (isDeliveryOnTime(row.expectedDeliveryDate, row.receivedAt))
      current.onTime += 1;
    else current.late += 1;
    result.set(row.supplierId, current);
  }
  return [...result.values()]
    .map((row) => ({
      ...row,
      recorded: row.onTime + row.late,
      onTimePercent:
        row.onTime + row.late === 0
          ? null
          : Math.round((row.onTime / (row.onTime + row.late)) * 100),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}
