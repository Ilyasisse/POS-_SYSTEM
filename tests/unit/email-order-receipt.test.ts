import assert from "node:assert/strict";
import test from "node:test";
import { renderReceiptEmailHtml } from "../../src/lib/orders/receipt-email-renderer";

test("renders completed order lines, modifiers, payments, and total", () => {
  const html = renderReceiptEmailHtml({
    businessName: "Mash Allah Cafe",
    currencyCode: "USD",
    orderNumber: 42,
    orderType: "DINE_IN",
    tableName: "Table 3",
    completedAt: new Date("2026-08-31T12:00:00.000Z"),
    total: 8.5,
    lines: [
      {
        productName: "Chicken Burger",
        qty: 1,
        lineTotal: 8.5,
        modifiers: [{ modifierName: "Extra cheese", qty: 1 }],
      },
    ],
    payments: [{ method: "GOLIS", amountPaid: 8.5, reference: "TIX-123" }],
  });

  assert.match(html, /Receipt #42/);
  assert.match(html, /Chicken Burger/);
  assert.match(html, /Extra cheese/);
  assert.match(html, /GOLIS/);
  assert.match(html, /USD 8\.50/);
  assert.match(html, /Table 3/);
});

test("escapes customer-visible database content before inserting HTML", () => {
  const html = renderReceiptEmailHtml({
    businessName: "Cafe <script>",
    currencyCode: "USD",
    orderNumber: 7,
    orderType: "TAKEAWAY",
    tableName: null,
    completedAt: new Date("2026-08-31T12:00:00.000Z"),
    total: 2,
    lines: [
      {
        productName: "Tea & <img>",
        qty: 1,
        lineTotal: 2,
        modifiers: [],
      },
    ],
    payments: [
      {
        method: "OTHER",
        amountPaid: 2,
        reference: `"><script>alert(1)</script>`,
      },
    ],
  });

  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<img>/);
  assert.match(html, /Cafe &lt;script&gt;/);
  assert.match(html, /Tea &amp; &lt;img&gt;/);
});
