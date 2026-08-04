export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function fundingFor(amount: number, availableRevenue: number) {
  const revenueFunded = roundMoney(Math.min(Math.max(availableRevenue, 0), amount));
  return { revenueFunded, savingsFunded: roundMoney(amount - revenueFunded) };
}

export function calculateDailyCashSummary(input: {
  revenue: number;
  paidRevenueFunded: number;
  paidSavingsFunded: number;
  unpaidRequired: number;
}) {
  const cashAvailableNow = roundMoney(Math.max(0, input.revenue - input.paidRevenueFunded));
  return {
    cashAvailableNow,
    projectedRemaining: roundMoney(Math.max(0, cashAvailableNow - input.unpaidRequired)),
    additionalSavingsRequired: roundMoney(Math.max(0, input.unpaidRequired - cashAvailableNow)),
    savingsUsed: roundMoney(input.paidSavingsFunded),
  };
}
