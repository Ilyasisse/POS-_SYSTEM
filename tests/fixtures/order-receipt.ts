import type { ReceiptOrderSource } from "../../src/lib/orders/build-receipt-data";

export function receiptOrder(
  overrides: Partial<ReceiptOrderSource> = {},
): ReceiptOrderSource {
  return {
    orderNumber: 123,
    status: "PAID",
    type: "DINE_IN",
    createdAt: new Date("2026-10-22T08:00:00Z"),
    closedAt: new Date("2026-10-22T08:30:00Z"),
    notes: "Please pack the extra sauce separately.",
    total: "12.50",
    table: { name: "Table 4" },
    tableCheck: { checkNumber: 2 },
    customer: { fullName: "Private Customer Name" },
    waiter: { fullName: "Cafe waiter" },
    cashier: null,
    orderItems: [
      {
        productName: "Chicken sandwich",
        qty: 2,
        unitPrice: "7.50",
        lineTotal: "15.00",
        modifiers: [{ qty: 1, modifierName: "Extra cheese" }],
      },
    ],
    payments: [
      { method: "GOLIS", reference: "PAYMENT-123", amountPaid: "12.50" },
    ],
    salesAdjustments: [
      { type: "DISCOUNT", amount: "2.50" },
      { type: "REFUND", amount: "1.00" },
    ],
    ...overrides,
  };
}

export const receiptSettings = {
  businessName: "Mash Allah Cafe",
  currencyCode: "USD",
  timezone: "Africa/Nairobi",
};

export function largeReceiptOrder() {
  return receiptOrder({
    orderNumber: 999,
    orderItems: Array.from({ length: 100 }, (_, index) => ({
      productName: `Item ${String(index + 1).padStart(3, "0")} ${"LongUnbrokenProductName".repeat(index === 0 ? 8 : 1)}`,
      qty: 1,
      unitPrice: "2.00",
      lineTotal: "2.00",
      modifiers: Array.from(
        { length: index === 0 ? 18 : 2 },
        (_, modifier) => ({
          qty: 1,
          modifierName: `Modifier ${modifier + 1} extra sauce`,
        }),
      ),
    })),
    total: "197.50",
    payments: [{ method: "CASH", reference: null, amountPaid: "197.50" }],
  });
}
