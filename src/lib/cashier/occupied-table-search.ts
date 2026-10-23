type OccupiedTable = {
  name: string;
  orders: readonly { orderNumber: number }[];
};

export function filterOccupiedTables<T extends OccupiedTable>(
  tables: readonly T[],
  query: string,
): T[] {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return [...tables];

  const orderNumber = /^#?[1-9]\d*$/.test(term)
    ? Number(term.replace(/^#/, ""))
    : null;
  return tables.filter(
    (table) =>
      table.name.toLocaleLowerCase().includes(term) ||
      (orderNumber !== null &&
        table.orders.some((order) => order.orderNumber === orderNumber)),
  );
}
