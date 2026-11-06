type Amount = number | string | { toString(): string };

export type ReceiptOrderSource = {
  orderNumber: number;
  type: string;
  status: string;
  table: { name: string } | null;
  cashier: { fullName: string } | null;
  createdAt: Date;
  closedAt: Date | null;
  notes: string | null;
  total: Amount;
  tableCheck: { checkNumber: number } | null;
  customer: { fullName: string } | null;
  waiter: { fullName: string } | null;
  orderItems: {
    productName: string;
    qty: number;
    unitPrice: Amount;
    lineTotal: Amount;
    modifiers: { qty: number; modifierName: string }[];
  }[];
  payments: { method: string; reference: string | null; amountPaid: Amount }[];
  salesAdjustments: { type: string; amount: Amount }[];
};

type ReceiptSettings = {
  businessName: string;
  currencyCode: string;
  timezone: string;
} | null;

function currencyFormatter(currency: string): Intl.NumberFormat {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: false,
    });
  } catch {
    return currencyFormatter("USD");
  }
}

function dateFormatter(timeZone: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone,
    });
  } catch {
    return dateFormatter("Africa/Nairobi");
  }
}

// Both layouts use stored sale amounts; modifier charges are already included.
// Only customer-facing display data leaves this adapter, never database records.
export function buildReceiptData(
  order: ReceiptOrderSource,
  settings: ReceiptSettings,
) {
  const formatter = currencyFormatter(settings?.currencyCode || "USD");
  const money = (value: Amount) => formatter.format(Number(value));
  const refunded = order.salesAdjustments
    .filter((adjustment) => adjustment.type === "REFUND")
    .reduce((sum, adjustment) => sum + Number(adjustment.amount), 0);

  return {
    businessName: settings?.businessName?.trim() || "Mash Allah Cafe",
    orderNumber: order.orderNumber,
    status: order.status,
    type: order.type.replaceAll("_", " "),
    dateTime: dateFormatter(settings?.timezone || "Africa/Nairobi").format(
      order.closedAt ?? order.createdAt,
    ),
    tableLabel: `${order.table?.name ?? "Counter"}${
      order.tableCheck ? ` · #${order.tableCheck.checkNumber}` : ""
    }`,
    servedBy: order.waiter?.fullName ?? order.cashier?.fullName ?? "Cafe staff",
    customerName: order.customer?.fullName ?? "Walk-in",
    items: order.orderItems.map((item, index) => ({
      position: index,
      name: item.productName,
      quantity: item.qty,
      unitPrice: money(item.unitPrice),
      lineTotal: money(item.lineTotal),
      modifiers: item.modifiers.map(
        (modifier) => `${modifier.qty}× ${modifier.modifierName}`,
      ),
    })),
    subtotal: money(
      order.orderItems.reduce((sum, item) => sum + Number(item.lineTotal), 0),
    ),
    reductions: order.salesAdjustments
      .filter((adjustment) =>
        ["DISCOUNT", "COMPLIMENTARY", "STAFF_MEAL"].includes(adjustment.type),
      )
      .map((adjustment, index) => ({
        position: index,
        label: adjustment.type.replaceAll("_", " "),
        amount: `-${money(adjustment.amount)}`,
      })),
    total: money(order.total),
    paid: money(
      order.payments.reduce(
        (sum, payment) => sum + Number(payment.amountPaid),
        0,
      ),
    ),
    refunded: refunded ? `-${money(refunded)}` : null,
    payments: order.payments.map((payment, index) => ({
      position: index,
      method: payment.method,
      reference: payment.reference,
      amount: money(payment.amountPaid),
    })),
    notes: order.notes,
  };
}

export type ReceiptData = ReturnType<typeof buildReceiptData>;
