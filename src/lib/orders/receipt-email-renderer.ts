export type ReceiptEmailSnapshot = {
  businessName: string;
  currencyCode: string;
  orderNumber: number;
  orderType: string;
  tableName: string | null;
  completedAt: Date;
  total: number;
  lines: Array<{
    productName: string;
    qty: number;
    lineTotal: number;
    modifiers: Array<{ modifierName: string; qty: number }>;
  }>;
  payments: Array<{
    method: string;
    amountPaid: number;
    reference: string | null;
  }>;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function money(value: number, currencyCode: string) {
  return `${escapeHtml(currencyCode)} ${value.toFixed(2)}`;
}

export function renderReceiptEmailHtml(receipt: ReceiptEmailSnapshot) {
  const lineRows = receipt.lines
    .map((line) => {
      const modifiers = line.modifiers.length
        ? `<div style="color:#64748b;font-size:12px;margin-top:3px;">${line.modifiers
            .map(
              (modifier) =>
                `${escapeHtml(modifier.modifierName)} × ${modifier.qty}`,
            )
            .join(" · ")}</div>`
        : "";

      return `<tr><td style="padding:9px 0;border-bottom:1px solid #e2e8f0;">${escapeHtml(line.productName)}${modifiers}</td><td style="padding:9px 8px;border-bottom:1px solid #e2e8f0;text-align:center;">${line.qty}</td><td style="padding:9px 0;border-bottom:1px solid #e2e8f0;text-align:right;">${money(line.lineTotal, receipt.currencyCode)}</td></tr>`;
    })
    .join("");
  const paymentRows = receipt.payments
    .map(
      (payment) =>
        `<li>${escapeHtml(payment.method)}: ${money(payment.amountPaid, receipt.currencyCode)}${payment.reference ? ` <span style="color:#64748b;">(${escapeHtml(payment.reference)})</span>` : ""}</li>`,
    )
    .join("");
  const completedAt = receipt.completedAt.toLocaleString("en-GB", {
    timeZone: "Africa/Nairobi",
    dateStyle: "medium",
    timeStyle: "short",
  });

  return `<!doctype html><html><body style="margin:0;background:#f8fafc;color:#0f172a;font-family:Arial,sans-serif;"><div style="max-width:600px;margin:0 auto;padding:28px 18px;"><div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:24px;"><h1 style="font-size:24px;margin:0 0 4px;">${escapeHtml(receipt.businessName)}</h1><p style="color:#64748b;margin:0 0 22px;">Receipt #${receipt.orderNumber}</p><p style="margin:0 0 6px;"><strong>Completed:</strong> ${escapeHtml(completedAt)}</p><p style="margin:0 0 18px;"><strong>Order:</strong> ${escapeHtml(receipt.orderType.replaceAll("_", " "))}${receipt.tableName ? ` · ${escapeHtml(receipt.tableName)}` : ""}</p><table style="width:100%;border-collapse:collapse;"><thead><tr><th style="padding:8px 0;text-align:left;border-bottom:2px solid #cbd5e1;">Item</th><th style="padding:8px;text-align:center;border-bottom:2px solid #cbd5e1;">Qty</th><th style="padding:8px 0;text-align:right;border-bottom:2px solid #cbd5e1;">Amount</th></tr></thead><tbody>${lineRows}</tbody></table><p style="font-size:20px;text-align:right;margin:18px 0;"><strong>Total: ${money(receipt.total, receipt.currencyCode)}</strong></p>${paymentRows ? `<h2 style="font-size:15px;margin:20px 0 6px;">Payments</h2><ul style="margin:0;padding-left:20px;">${paymentRows}</ul>` : ""}<p style="color:#64748b;font-size:12px;margin:24px 0 0;">Thank you for your visit.</p></div></div></body></html>`;
}
