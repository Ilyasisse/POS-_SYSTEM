export type ProductPerformance = {
  id: string;
  name: string;
  quantity: number;
  grossSales: string;
  grossProfit: string | null;
};

export type MenuClass = "Star" | "Puzzle" | "Workhorse" | "Review";

export function classifyMenuProducts(products: readonly ProductPerformance[]) {
  const sold = products.filter((row) => row.quantity > 0);
  const eligible = sold.filter(
    (row) =>
      row.grossProfit !== null && Number.isFinite(Number(row.grossProfit)),
  );
  const excluded = sold.length - eligible.length;
  if (!eligible.length) {
    return { popularityAverage: 0, unitProfitAverage: 0, excluded, rows: [] };
  }
  const popularityAverage =
    sold.reduce((sum, row) => sum + row.quantity, 0) / sold.length;
  const unitProfitAverage =
    eligible.reduce(
      (sum, row) => sum + Number(row.grossProfit) / row.quantity,
      0,
    ) / eligible.length;
  const rows = eligible.map((row) => {
    const unitProfit = Number(row.grossProfit) / row.quantity;
    const popular = row.quantity >= popularityAverage;
    const profitable = unitProfit >= unitProfitAverage;
    const category: MenuClass = popular
      ? profitable
        ? "Star"
        : "Workhorse"
      : profitable
        ? "Puzzle"
        : "Review";
    return { ...row, unitProfit, category };
  });
  return { popularityAverage, unitProfitAverage, excluded, rows };
}
