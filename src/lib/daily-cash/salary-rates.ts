export function resolveDailySalaryRate<T extends { effectiveBusinessDate: Date }>(
  businessDate: Date,
  rates: readonly T[],
) {
  return rates
    .filter((rate) => rate.effectiveBusinessDate <= businessDate)
    .sort((a, b) => b.effectiveBusinessDate.getTime() - a.effectiveBusinessDate.getTime())[0] ?? null;
}
