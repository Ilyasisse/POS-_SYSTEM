const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export function formatMoney(value: number) {
  return moneyFormatter.format(value);
}
