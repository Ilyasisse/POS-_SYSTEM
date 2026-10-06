import type { InventoryAlertStatus } from "@prisma/client";

export type DailyInventoryDigestItem = {
  id: string;
  name: string;
  unit: string;
  itemType: "Supply" | "Product";
  stockQty: number;
  lowStockThreshold: number;
  inventoryAlertStatus: InventoryAlertStatus;
  previousInventoryAlertStatus: InventoryAlertStatus;
};

/**
 * Escapes unsafe HTML characters before inserting text into email HTML.
 *
 * @param value - The text value to escape.
 * @returns The HTML-safe text value.
 */
function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Formats the HTML email body for the daily tracked inventory digest.
 *
 * @param items - The tracked inventory items to include in the digest.
 * @returns The HTML body for the daily digest email.
 */
export function formatDailyInventoryDigestHtml(
  items: DailyInventoryDigestItem[],
) {
  const alertItems = items.filter(
    (item) =>
      item.inventoryAlertStatus === "LOW" ||
      item.inventoryAlertStatus === "OUT",
  );

  if (alertItems.length === 0) {
    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
        <h2 style="margin: 0 0 12px;">Daily Inventory Alert</h2>
        <p style="margin: 0;">All tracked products and internal supplies are OK.</p>
      </div>
    `;
  }

  const rows = alertItems
    .map(
      (item) => `
        <tr>
          <td style="border-bottom: 1px solid #e2e8f0; padding: 8px;">${escapeHtml(item.itemType)}</td>
          <td style="border-bottom: 1px solid #e2e8f0; padding: 8px;">${escapeHtml(item.name)}</td>
          <td style="border-bottom: 1px solid #e2e8f0; padding: 8px;">${escapeHtml(item.inventoryAlertStatus)}</td>
          <td style="border-bottom: 1px solid #e2e8f0; padding: 8px;">${item.stockQty} ${escapeHtml(item.unit)}</td>
          <td style="border-bottom: 1px solid #e2e8f0; padding: 8px;">${item.lowStockThreshold} ${escapeHtml(item.unit)}</td>
        </tr>
      `,
    )
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
      <h2 style="margin: 0 0 12px;">Daily Inventory Alert</h2>
      <p style="margin: 0 0 12px;">The following tracked products and internal supplies are low or out of stock.</p>
      <table style="border-collapse: collapse; width: 100%;">
        <thead>
          <tr>
            <th align="left" style="border-bottom: 2px solid #cbd5e1; padding: 8px;">Type</th>
            <th align="left" style="border-bottom: 2px solid #cbd5e1; padding: 8px;">Item</th>
            <th align="left" style="border-bottom: 2px solid #cbd5e1; padding: 8px;">Status</th>
            <th align="left" style="border-bottom: 2px solid #cbd5e1; padding: 8px;">Current stock</th>
            <th align="left" style="border-bottom: 2px solid #cbd5e1; padding: 8px;">Low threshold</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}
