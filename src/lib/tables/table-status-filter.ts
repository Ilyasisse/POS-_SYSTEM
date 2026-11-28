export type TableView = "all" | "available" | "occupied" | "hidden";

type StatusSummary = {
  isActive: boolean;
  orders: readonly unknown[];
};

type TableSummary = StatusSummary & { name: string };

export function parseTableView(value?: string): TableView {
  return value === "available" || value === "occupied" || value === "hidden"
    ? value
    : "all";
}

export function tableStatus(table: StatusSummary): Exclude<TableView, "all"> {
  if (!table.isActive) return "hidden";
  return table.orders.length ? "occupied" : "available";
}

export function filterTables<T extends TableSummary>(
  tables: readonly T[],
  query: string,
  view: TableView,
): T[] {
  const term = query.trim().toLocaleLowerCase();
  return tables.filter(
    (table) =>
      (!term || table.name.toLocaleLowerCase().includes(term)) &&
      (view === "all" || tableStatus(table) === view),
  );
}
