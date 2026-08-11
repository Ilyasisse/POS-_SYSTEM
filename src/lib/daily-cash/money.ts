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
  savingsDeposited?: number;
}) {
  const cashAvailableNow = roundMoney(
    Math.max(
      0,
      input.revenue - input.paidRevenueFunded - (input.savingsDeposited ?? 0),
    ),
  );
  return {
    cashAvailableNow,
    projectedRemaining: roundMoney(Math.max(0, cashAvailableNow - input.unpaidRequired)),
    additionalSavingsRequired: roundMoney(Math.max(0, input.unpaidRequired - cashAvailableNow)),
    savingsUsed: roundMoney(input.paidSavingsFunded),
  };
}

export function validateSavingsDepositAmount(
  amount: number,
  projectedRemaining: number,
) {
  const roundedAmount = roundMoney(amount);
  if (
    !Number.isFinite(amount) ||
    roundedAmount <= 0 ||
    Math.abs(amount - roundedAmount) > Number.EPSILON
  ) {
    throw new Error("Enter a savings amount greater than zero with no more than two decimal places.");
  }
  if (roundedAmount > roundMoney(projectedRemaining)) {
    throw new Error("Savings cannot exceed the projected remaining cash.");
  }
  return roundedAmount;
}
