import { InventoryAlertStatus, Prisma } from "@prisma/client";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

export type InventorySaleLine = {
  productId: string;
  qty: number;
};

export type InventoryAlert = {
  itemName: string;
  itemType: "Product" | "Supply";
  status: InventoryAlertStatus;
  stockQty: number;
  lowStockThreshold: number;
};

export type InventoryAlertSendResult = {
  attempted: number;
  sent: number;
  failed: number;
  skipped: boolean;
  reason?: "missing_email_environment";
};

type InventoryTrackedItem = {
  stockQty: number;
  lowStockThreshold: number;
  inventoryAlertStatus: InventoryAlertStatus;
};

type DailySupplyDigestItem = {
  id: string;
  name: string;
  unit: string;
  stockQty: number;
  lowStockThreshold: number;
  inventoryAlertStatus: InventoryAlertStatus;
  previousInventoryAlertStatus: InventoryAlertStatus;
};

/**
 * Converts a number-like quantity into a non-negative whole number.
 *
 * @param value - The quantity value to normalize.
 * @returns A safe whole-number quantity.
 */
export function toValidQuantity(value: number) {
  return Math.max(0, Math.floor(Number(value) || 0));
}



/**
 * Calculates the inventory alert status for a stock quantity and low-stock threshold.
 *
 * @param stockQty - The current stock quantity.
 * @param lowStockThreshold - The threshold that marks an item as low stock.
 * @returns The current inventory alert status.
 */
export function getInventoryAlertStatus(
  stockQty: number,
  lowStockThreshold: number,
): InventoryAlertStatus {
  if (stockQty <= 0) {
    return "OUT";
  }

  if (lowStockThreshold > 0 && stockQty <= lowStockThreshold) {
    return "LOW";
  }

  return "OK";
}

/**
 * Builds an inventory alert when a stock change enters LOW or OUT status.
 *
 * @param item - The inventory item before the stock change.
 * @param itemName - The display name for the item.
 * @param itemType - Whether the item is a product or supply.
 * @param nextStockQty - The stock quantity after the change.
 * @param nextLowStockThreshold - The low-stock threshold after the change.
 * @param delta - The stock movement amount.
 * @returns The next status and an alert when one should be sent.
 */
function buildInventoryAlert(
  item: InventoryTrackedItem,
  itemName: string,
  itemType: InventoryAlert["itemType"],
  nextStockQty: number,
  nextLowStockThreshold: number,
  delta: number,
): { status: InventoryAlertStatus; alert: InventoryAlert | null } {
  const status = getInventoryAlertStatus(nextStockQty, nextLowStockThreshold);
  const shouldAlert =
    delta <= 0 &&
    status !== "OK" &&
    status !== item.inventoryAlertStatus;

  return {
    status,
    alert: shouldAlert
      ? {
          itemName,
          itemType,
          status,
          stockQty: nextStockQty,
          lowStockThreshold: nextLowStockThreshold,
        }
      : null,
  };
}

/**
 * Converts an inventory alert status into the email subject label.
 *
 * @param alert - The inventory alert to label.
 * @returns A readable alert status label.
 */
function getInventoryAlertStatusLabel(alert: InventoryAlert) {
  return alert.status === "OUT" ? "OUT OF STOCK" : "LOW STOCK";
}

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
 * Formats the HTML email body for a single inventory alert.
 *
 * @param alert - The inventory alert to render.
 * @returns The HTML body for the alert email.
 */
function formatInventoryAlertHtml(alert: InventoryAlert) {
  const statusLabel = alert.status === "OUT" ? "OUT OF STOCK" : "LOW STOCK";

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
      <h2 style="margin: 0 0 12px;">Inventory Alert: ${statusLabel}</h2>
      <p style="margin: 0 0 8px;"><strong>${alert.itemType}:</strong> ${alert.itemName}</p>
      <p style="margin: 0 0 8px;"><strong>Current stock:</strong> ${alert.stockQty}</p>
      <p style="margin: 0;"><strong>Low threshold:</strong> ${alert.lowStockThreshold}</p>
    </div>
  `;
}

/**
 * Sends immediate inventory alert emails for products or supplies that become LOW or OUT.
 *
 * @param alerts - The inventory alerts that should be delivered.
 * @returns The email delivery summary.
 */
export async function sendInventoryAlerts(alerts: InventoryAlert[]) {
  if (alerts.length === 0) {
    return {
      attempted: 0,
      sent: 0,
      failed: 0,
      skipped: false,
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INVENTORY_ALERT_EMAIL_FROM;
  const to = process.env.INVENTORY_ALERT_EMAIL_TO;

  if (!apiKey || !from || !to) {
    const missingVariables = [
      !apiKey ? "RESEND_API_KEY" : null,
      !from ? "INVENTORY_ALERT_EMAIL_FROM" : null,
      !to ? "INVENTORY_ALERT_EMAIL_TO" : null,
    ].filter(Boolean);

    console.warn(
      `Inventory email alert skipped: missing Resend environment variables (${missingVariables.join(", ")}).`,
    );

    return {
      attempted: alerts.length,
      sent: 0,
      failed: 0,
      skipped: true,
      reason: "missing_email_environment" as const,
    };
  }

  const resend = new Resend(apiKey);
  const results = await Promise.all(
    alerts.map(async (alert) => {
      try {
        const result = await resend.emails.send({
          from,
          to,
          subject: `Inventory Alert: ${getInventoryAlertStatusLabel(alert)}`,
          html: formatInventoryAlertHtml(alert),
        });

        if (result.error) {
          throw result.error;
        }

        if (process.env.NODE_ENV !== "production") {
          console.info(
            `Inventory email alert sent for ${alert.itemType} "${alert.itemName}" with status ${alert.status}.`,
          );
        }

        return true;
      } catch (error) {
        console.error(
          `Inventory email alert failed for ${alert.itemType} "${alert.itemName}" with status ${alert.status}:`,
          error,
        );

        return false;
      }
    }),
  );

  const sent = results.filter(Boolean).length;

  return {
    attempted: alerts.length,
    sent,
    failed: alerts.length - sent,
    skipped: false,
  };
}

/**
 * Formats the HTML email body for the daily internal supply inventory digest.
 *
 * @param items - The supply inventory items to include in the digest.
 * @returns The HTML body for the daily digest email.
 */
function formatDailyInventoryDigestHtml(items: DailySupplyDigestItem[]) {
  const alertItems = items.filter(
    (item) =>
      item.inventoryAlertStatus === "LOW" ||
      item.inventoryAlertStatus === "OUT",
  );

  if (alertItems.length === 0) {
    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
        <h2 style="margin: 0 0 12px;">Daily Inventory Alert</h2>
        <p style="margin: 0;">All internal supplies are OK.</p>
      </div>
    `;
  }

  const rows = alertItems
    .map(
      (item) => `
        <tr>
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
      <p style="margin: 0 0 12px;">The following internal supplies are low or out of stock.</p>
      <table style="border-collapse: collapse; width: 100%;">
        <thead>
          <tr>
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

/**
 * Sends the daily internal supply digest and refreshes supply alert statuses.
 *
 * @returns The daily digest delivery summary and low/out stock counts.
 */
export async function sendDailyInventorySupplyDigest() {
  const supplies = await prisma.inventorySupply.findMany({
    where: {
      isActive: true,
    },
    orderBy: [{ stockQty: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      unit: true,
      stockQty: true,
      lowStockThreshold: true,
      inventoryAlertStatus: true,
    },
  });

  const items = supplies.map<DailySupplyDigestItem>((supply) => ({
    ...supply,
    stockQty: toValidQuantity(supply.stockQty),
    lowStockThreshold: toValidQuantity(supply.lowStockThreshold),
    previousInventoryAlertStatus: supply.inventoryAlertStatus,
    inventoryAlertStatus: getInventoryAlertStatus(
      supply.stockQty,
      supply.lowStockThreshold,
    ),
  }));

  await Promise.all(
    items
      .filter(
        (item) =>
          item.inventoryAlertStatus !== item.previousInventoryAlertStatus,
      )
      .map((item) =>
        prisma.inventorySupply.update({
          where: { id: item.id },
          data: { inventoryAlertStatus: item.inventoryAlertStatus },
        }),
      ),
  );

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INVENTORY_ALERT_EMAIL_FROM;
  const to = process.env.INVENTORY_ALERT_EMAIL_TO;
  const lowStockCount = items.filter(
    (item) => item.inventoryAlertStatus === "LOW",
  ).length;
  const outOfStockCount = items.filter(
    (item) => item.inventoryAlertStatus === "OUT",
  ).length;

  if (!apiKey || !from || !to) {
    console.warn(
      "Daily inventory email skipped: missing Resend environment variables.",
    );

    return {
      sent: false,
      lowStockCount,
      outOfStockCount,
      reason: "missing_email_environment",
    };
  }

  const resend = new Resend(apiKey);

  await resend.emails.send({
    from,
    to,
    subject: "Daily Inventory Alert",
    html: formatDailyInventoryDigestHtml(items),
  });

  return {
    sent: true,
    lowStockCount,
    outOfStockCount,
  };
}

/**
 * Deducts product inventory after a sale.
 *
 * @param tx - The Prisma transaction client used for the sale.
 * @param lines - The sold product lines to deduct from stock.
 * @returns Inventory alerts created by the deduction.
 */
export async function deductProductInventoryForSale(
  tx: Prisma.TransactionClient,
  lines: InventorySaleLine[],
) {
  // Product sale inventory now updates only Product stock and alert status.
  // Movement history is intentionally supply-only because InventoryMovement no
  // longer has productId in Supabase or the Prisma schema.
  const quantityByProductId = new Map<string, number>();

  for (const line of lines) {
    const qty = Math.max(1, Math.floor(Number(line.qty) || 1));
    quantityByProductId.set(
      line.productId,
      (quantityByProductId.get(line.productId) ?? 0) + qty,
    );
  }

  const productIds = [...quantityByProductId.keys()];

  if (productIds.length === 0) {
    return [];
  }

  const products = await tx.product.findMany({
    where: {
      id: { in: productIds },
      trackStock: true,
    },
    select: {
      id: true,
      name: true,
      stockQty: true,
      lowStockThreshold: true,
      inventoryAlertStatus: true,
    },
  });

  const alerts: InventoryAlert[] = [];

  for (const product of products) {
    const soldQty = quantityByProductId.get(product.id) ?? 0;
    const quantityBefore = toValidQuantity(product.stockQty);
    const quantityAfter = Math.max(quantityBefore - soldQty, 0);
    const delta = quantityAfter - quantityBefore;
    const lowStockThreshold = toValidQuantity(product.lowStockThreshold);
    const { status, alert } = buildInventoryAlert(
      product,
      product.name,
      "Product",
      quantityAfter,
      lowStockThreshold,
      delta,
    );

    await tx.product.update({
      where: { id: product.id },
      data: {
        stockQty: quantityAfter,
        lowStockThreshold,
        inventoryAlertStatus: status,
      },
    });

    if (alert) {
      alerts.push(alert);
    }
  }

  return alerts;
}

/**
 * Sets a product inventory level and updates alert status.
 *
 * @param tx - The Prisma transaction client used for the inventory update.
 * @param productId - The product being updated.
 * @param nextStockQty - The next stock quantity.
 * @param nextLowStockThreshold - The next low-stock threshold.
 * @returns Inventory alerts created by the product update.
 */
export async function setProductInventoryLevel(
  tx: Prisma.TransactionClient,
  productId: string,
  nextStockQty: number,
  nextLowStockThreshold: number,
) {
  // Admin product adjustments keep their stock/alert behavior but no longer
  // write InventoryMovement rows. This prevents Prisma from touching the deleted
  // InventoryMovement.productId column while preserving product inventory totals.
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      stockQty: true,
      lowStockThreshold: true,
      inventoryAlertStatus: true,
    },
  });

  if (!product) {
    throw new Error("Product not found.");
  }

  const quantityBefore = toValidQuantity(product.stockQty);
  const quantityAfter = toValidQuantity(nextStockQty);
  const delta = quantityAfter - quantityBefore;
  const lowStockThreshold = toValidQuantity(nextLowStockThreshold);
  const { status, alert } = buildInventoryAlert(
    product,
    product.name,
    "Product",
    quantityAfter,
    lowStockThreshold,
    delta,
  );

  await tx.product.update({
    where: { id: product.id },
    data: {
      trackStock: true,
      stockQty: quantityAfter,
      lowStockThreshold,
      inventoryAlertStatus: status,
    },
  });

  return alert ? [alert] : [];
}

/**
 * Sets a supply inventory level, updates alert status, and records movement history.
 *
 * @param tx - The Prisma transaction client used for the inventory update.
 * @param supplyId - The supply being updated.
 * @param nextStockQty - The next stock quantity.
 * @param nextLowStockThreshold - The next low-stock threshold.
 * @param reason - The movement reason stored in inventory history.
 * @param note - Optional movement note stored in inventory history.
 * @returns Inventory alerts created by the supply update.
 */
export async function setSupplyInventoryLevel(
  tx: Prisma.TransactionClient,
  supplyId: string,
  nextStockQty: number,
  nextLowStockThreshold: number,
  reason: string,
  note?: string,
) {
  const supply = await tx.inventorySupply.findUnique({
    where: { id: supplyId },
    select: {
      id: true,
      name: true,
      unit: true,
      stockQty: true,
      lowStockThreshold: true,
      inventoryAlertStatus: true,
    },
  });

  if (!supply) {
    throw new Error("Supply not found.");
  }

  const quantityBefore = toValidQuantity(supply.stockQty);
  const quantityAfter = toValidQuantity(nextStockQty);
  const delta = quantityAfter - quantityBefore;
  const lowStockThreshold = toValidQuantity(nextLowStockThreshold);
  const { status, alert } = buildInventoryAlert(
    supply,
    supply.name,
    "Supply",
    quantityAfter,
    lowStockThreshold,
    delta,
  );
  const forcedZeroStockAlert =
    status === "OUT" &&
    quantityAfter === 0 &&
    (delta < 0 || reason === "TAKEN");
  const supplyAlert =
    alert ??
    (forcedZeroStockAlert
      ? {
          itemName: supply.name,
          itemType: "Supply" as const,
          status,
          stockQty: quantityAfter,
          lowStockThreshold,
        }
      : null);

  await tx.inventorySupply.update({
    where: { id: supply.id },
    data: {
      stockQty: quantityAfter,
      lowStockThreshold,
      inventoryAlertStatus: status,
    },
  });

  if (delta !== 0) {
    // Supply movements are still recorded here because InventoryMovement is now
    // the audit trail for InventorySupply usage/restocks only.
    await tx.inventoryMovement.create({
      data: {
        supplyId: supply.id,
        itemName: `${supply.name} (${supply.unit})`,
        itemType: "Supply",
        delta,
        quantityBefore,
        quantityAfter,
        reason,
        note: note || null,
      },
    });
  }

  return supplyAlert ? [supplyAlert] : [];
}
