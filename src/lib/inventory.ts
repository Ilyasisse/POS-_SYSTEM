import { Resend } from "resend";
import { InventoryAlertStatus, Prisma } from "@prisma/client";
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

function normalizeQuantity(value: number) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function normalizeThreshold(value: number) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

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

function getInventoryAlertStatusLabel(alert: InventoryAlert) {
  return alert.status === "OUT" ? "OUT OF STOCK" : "LOW STOCK";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatInventoryAlertHtml(alert: InventoryAlert) {
  const statusLabel =
    alert.status === "OUT" ? "OUT OF STOCK" : "LOW STOCK";

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
      <h2 style="margin: 0 0 12px;">Inventory Alert: ${statusLabel}</h2>
      <p style="margin: 0 0 8px;"><strong>${alert.itemType}:</strong> ${alert.itemName}</p>
      <p style="margin: 0 0 8px;"><strong>Current stock:</strong> ${alert.stockQty}</p>
      <p style="margin: 0;"><strong>Low threshold:</strong> ${alert.lowStockThreshold}</p>
    </div>
  `;
}

export async function sendInventoryAlerts(alerts: InventoryAlert[]) {
  if (alerts.length === 0) {
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INVENTORY_ALERT_EMAIL_FROM;
  const to = process.env.INVENTORY_ALERT_EMAIL_TO;

  if (!apiKey || !from || !to) {
    console.warn(
      "Inventory email alert skipped: missing Resend environment variables.",
    );
    return;
  }

  const resend = new Resend(apiKey);

  await Promise.all(
    alerts.map(async (alert) => {
      try {
        await resend.emails.send({
          from,
          to,
          subject: `Inventory Alert: ${getInventoryAlertStatusLabel(alert)}`,
          html: formatInventoryAlertHtml(alert),
        });
      } catch (error) {
        console.error("Inventory email alert failed:", error);
      }
    }),
  );
}

function formatDailyInventoryDigestHtml(items: DailySupplyDigestItem[]) {
  const alertItems = items.filter(
    (item) => item.inventoryAlertStatus === "LOW" || item.inventoryAlertStatus === "OUT",
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
    stockQty: normalizeQuantity(supply.stockQty),
    lowStockThreshold: normalizeThreshold(supply.lowStockThreshold),
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
  const lowStockCount = items.filter((item) => item.inventoryAlertStatus === "LOW").length;
  const outOfStockCount = items.filter((item) => item.inventoryAlertStatus === "OUT").length;

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

export async function deductProductInventoryForSale(
  tx: Prisma.TransactionClient,
  lines: InventorySaleLine[],
  note?: string,
) {
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
    const quantityBefore = normalizeQuantity(product.stockQty);
    const quantityAfter = Math.max(quantityBefore - soldQty, 0);
    const delta = quantityAfter - quantityBefore;
    const lowStockThreshold = normalizeThreshold(product.lowStockThreshold);
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

    if (delta !== 0) {
      await tx.inventoryMovement.create({
        data: {
          productId: product.id,
          itemName: product.name,
          itemType: "Product",
          delta,
          quantityBefore,
          quantityAfter,
          reason: "SALE",
          note: note || null,
        },
      });
    }

    if (alert) {
      alerts.push(alert);
    }
  }

  return alerts;
}

export async function setProductInventoryLevel(
  tx: Prisma.TransactionClient,
  productId: string,
  nextStockQty: number,
  nextLowStockThreshold: number,
  reason: string,
  note?: string,
) {
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

  const quantityBefore = normalizeQuantity(product.stockQty);
  const quantityAfter = normalizeQuantity(nextStockQty);
  const delta = quantityAfter - quantityBefore;
  const lowStockThreshold = normalizeThreshold(nextLowStockThreshold);
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

  if (delta !== 0) {
    await tx.inventoryMovement.create({
      data: {
        productId: product.id,
        itemName: product.name,
        itemType: "Product",
        delta,
        quantityBefore,
        quantityAfter,
        reason,
        note: note || null,
      },
    });
  }

  return alert ? [alert] : [];
}

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

  const quantityBefore = normalizeQuantity(supply.stockQty);
  const quantityAfter = normalizeQuantity(nextStockQty);
  const delta = quantityAfter - quantityBefore;
  const lowStockThreshold = normalizeThreshold(nextLowStockThreshold);
  const { status, alert } = buildInventoryAlert(
    supply,
    supply.name,
    "Supply",
    quantityAfter,
    lowStockThreshold,
    delta,
  );

  await tx.inventorySupply.update({
    where: { id: supply.id },
    data: {
      stockQty: quantityAfter,
      lowStockThreshold,
      inventoryAlertStatus: status,
    },
  });

  if (delta !== 0) {
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

  return alert ? [alert] : [];
}
