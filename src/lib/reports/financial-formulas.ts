import { Prisma } from "@prisma/client";

export type DecimalInput = Prisma.Decimal | string | number;
export const money = (value: DecimalInput = 0) => new Prisma.Decimal(value).toDecimalPlaces(2);
export const sumMoney = (values: readonly DecimalInput[]) => values.reduce<Prisma.Decimal>((total, value) => total.plus(value), money(0)).toDecimalPlaces(2);
export const grossSales = (lines: readonly DecimalInput[]) => sumMoney(lines);
export const netSales = (gross: DecimalInput, discounts: DecimalInput, refunds: DecimalInput) => money(gross).minus(discounts).minus(refunds).toDecimalPlaces(2);
export const grossProfit = (net: DecimalInput, cogs: DecimalInput) => money(net).minus(cogs).toDecimalPlaces(2);
export function ratioPercent(numerator: DecimalInput, denominator: DecimalInput) {
  const divisor = money(denominator);
  return divisor.isZero() ? null : money(numerator).dividedBy(divisor).times(100).toDecimalPlaces(2);
}
export function averageOrderValue(net: DecimalInput, count: number) {
  return Number.isInteger(count) && count > 0 ? money(net).dividedBy(count).toDecimalPlaces(2) : null;
}
export const settlementVariance = (handedIn: DecimalInput, expected: DecimalInput) => money(handedIn).minus(expected).toDecimalPlaces(2);
export function expectedStock(input: { opening: DecimalInput; received: DecimalInput; usage: DecimalInput; waste: DecimalInput; adjustments: DecimalInput }) {
  return new Prisma.Decimal(input.opening).plus(input.received).minus(input.usage).minus(input.waste).plus(input.adjustments);
}
export const inventoryVariance = (physical: DecimalInput, expected: DecimalInput) => new Prisma.Decimal(physical).minus(expected);
export function netProfit(input: { netSales: DecimalInput; cogs: DecimalInput; labour: DecimalInput; operatingExpenses: DecimalInput }) {
  return money(input.netSales).minus(input.cogs).minus(input.labour).minus(input.operatingExpenses).toDecimalPlaces(2);
}
export function breakEvenSales(fixedCosts: DecimalInput, contributionMarginRatio: DecimalInput) {
  const ratio = new Prisma.Decimal(contributionMarginRatio);
  return ratio.lte(0) ? null : money(fixedCosts).dividedBy(ratio).toDecimalPlaces(2);
}
