export type ExportOrderRow = {
  orderNumber: number;
  createdAt: Date;
  status: string;
  type: string;
  total: string;
  tableName: string | null;
  cashierName: string | null;
  waiterName: string | null;
  itemCount: number;
};

const headers = [
  "Order Number",
  "Created At (UTC)",
  "Status",
  "Type",
  "Total (USD)",
  "Table",
  "Cashier",
  "Waiter",
  "Item Count",
];

function csvCell(value: string) {
  // Spreadsheet apps may execute cells starting with a formula operator.
  const safe =
    /^\s*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function toOrderHistoryCsv(orders: readonly ExportOrderRow[]) {
  const lines = orders.map((order) =>
    [
      String(order.orderNumber),
      order.createdAt.toISOString(),
      order.status,
      order.type,
      order.total,
      order.tableName ?? "",
      order.cashierName ?? "",
      order.waiterName ?? "",
      String(order.itemCount),
    ]
      .map(csvCell)
      .join(","),
  );
  return [headers.join(","), ...lines].join("\r\n") + "\r\n";
}
