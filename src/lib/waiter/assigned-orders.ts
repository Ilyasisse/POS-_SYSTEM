export function getOutstandingOrderTotal(
  total: number,
  payments: Array<{ amountPaid: number }>,
) {
  const paid = payments.reduce(
    (sum, payment) => sum + Number(payment.amountPaid || 0),
    0,
  );
  return Math.max(0, Math.round((Number(total) - paid) * 100) / 100);
}
