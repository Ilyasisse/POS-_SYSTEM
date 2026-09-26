import { getPaymentReceiptBusinessDayRange } from "../cashier/cashier-business-day";

// Keep Admin → Orders aligned with the POS's 07:00 Africa/Nairobi payment day.
export function getOrderBusinessDayRange(now: Date = new Date()) {
  return getPaymentReceiptBusinessDayRange(now);
}

export function summarizeOrderBusinessDay(
  orders: readonly { status: string; total: number }[],
) {
  return orders.reduce(
    (summary, order) => {
      if (order.status === "OPEN") summary.open += 1;
      if (order.status === "PAID") {
        summary.paid += 1;
        summary.paidRevenue += order.total;
      }
      return summary;
    },
    { open: 0, paid: 0, paidRevenue: 0 },
  );
}
