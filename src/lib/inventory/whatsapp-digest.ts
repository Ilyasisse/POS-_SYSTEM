export type LowStockDigestItem = {
  name: string;
  kind: "Product" | "Supply";
  quantity: string;
  threshold: string;
  unit: string;
};

const cafeDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Nairobi",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function inventoryDigestDate(now: Date): string {
  const parts = Object.fromEntries(
    cafeDate.formatToParts(now).map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function clean(value: string, max: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

/** A compact body for an approved WhatsApp template with variable {{1}}. */
export function formatInventoryWhatsAppDigest(
  items: LowStockDigestItem[],
  date: string,
) {
  if (!items.length) return null;
  const shown = items.slice(0, 12);
  const lines = shown.map(
    (item) =>
      `${item.kind}: ${clean(item.name, 45)} — ${clean(item.quantity, 18)} ${clean(item.unit, 15)} (low at ${clean(item.threshold, 18)})`,
  );
  return [
    `Inventory low-stock alert ${date}: ${items.length} item(s).`,
    ...lines,
    ...(items.length > shown.length
      ? [`+${items.length - shown.length} more; check the POS inventory page.`]
      : []),
  ].join("\n");
}
