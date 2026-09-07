export type AccountingJournalRow = {
  date: string;
  entryId: string;
  source: "SALE_PAYMENT" | "EXPENSE" | "SUPPLIER_PAYMENT" | "OWNER_WITHDRAWAL";
  account: string;
  debit: number;
  credit: number;
  memo: string;
  reference: string;
};

type JournalSources = {
  payments: Array<{
    id: string;
    date: Date;
    method: string;
    amount: number;
    orderNumber: number;
    reference: string | null;
  }>;
  expenses: Array<{
    id: string;
    date: Date;
    category: string;
    amount: number;
    paymentMethod: string | null;
    vendor: string | null;
    reference: string | null;
  }>;
  supplierPayments: Array<{
    id: string;
    date: Date;
    supplier: string;
    amount: number;
    allocatedAmount: number;
    paymentMethod: string | null;
  }>;
  ownerWithdrawals: Array<{
    id: string;
    date: Date;
    amount: number;
    reason: string;
    reference: string | null;
  }>;
};

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1_000;
const dateKey = (value: Date) => new Date(value.getTime() + NAIROBI_OFFSET_MS).toISOString().slice(0, 10);

function clearingAccount(method: string | null) {
  const normalized = method?.trim();
  if (!normalized || normalized.toUpperCase() === "CASH") return "Cash on hand";
  return `${normalized} clearing`;
}

function row(input: Omit<AccountingJournalRow, "debit" | "credit"> & { debit?: number; credit?: number }) {
  return {
    ...input,
    debit: roundMoney(input.debit ?? 0),
    credit: roundMoney(input.credit ?? 0),
  } satisfies AccountingJournalRow;
}

export function buildAccountingJournal(sources: JournalSources) {
  const rows: AccountingJournalRow[] = [];

  for (const payment of sources.payments) {
    const amount = roundMoney(payment.amount);
    if (amount <= 0) continue;
    const common = {
      date: dateKey(payment.date),
      entryId: `payment-${payment.id}`,
      source: "SALE_PAYMENT" as const,
      memo: `Order #${payment.orderNumber}`,
      reference: payment.reference ?? `ORDER-${payment.orderNumber}`,
    };
    rows.push(
      row({ ...common, account: clearingAccount(payment.method), debit: amount }),
      row({ ...common, account: "Sales revenue", credit: amount }),
    );
  }

  for (const expense of sources.expenses) {
    const amount = roundMoney(expense.amount);
    if (amount <= 0) continue;
    const common = {
      date: dateKey(expense.date),
      entryId: `expense-${expense.id}`,
      source: "EXPENSE" as const,
      memo: expense.vendor ? `${expense.category} — ${expense.vendor}` : expense.category,
      reference: expense.reference ?? expense.id,
    };
    rows.push(
      row({ ...common, account: `Expense: ${expense.category}`, debit: amount }),
      row({ ...common, account: clearingAccount(expense.paymentMethod), credit: amount }),
    );
  }

  for (const payment of sources.supplierPayments) {
    const amount = roundMoney(payment.amount);
    if (amount <= 0) continue;
    const allocated = Math.min(amount, Math.max(0, roundMoney(payment.allocatedAmount)));
    const advance = roundMoney(amount - allocated);
    const common = {
      date: dateKey(payment.date),
      entryId: `supplier-payment-${payment.id}`,
      source: "SUPPLIER_PAYMENT" as const,
      memo: `Payment to ${payment.supplier}`,
      reference: payment.id,
    };
    if (allocated > 0) rows.push(row({ ...common, account: "Accounts payable", debit: allocated }));
    if (advance > 0) rows.push(row({ ...common, account: "Supplier advances", debit: advance }));
    rows.push(row({ ...common, account: clearingAccount(payment.paymentMethod), credit: amount }));
  }

  for (const withdrawal of sources.ownerWithdrawals) {
    const amount = roundMoney(withdrawal.amount);
    if (amount <= 0) continue;
    const common = {
      date: dateKey(withdrawal.date),
      entryId: `owner-withdrawal-${withdrawal.id}`,
      source: "OWNER_WITHDRAWAL" as const,
      memo: withdrawal.reason,
      reference: withdrawal.reference ?? withdrawal.id,
    };
    rows.push(
      row({ ...common, account: "Owner draws", debit: amount }),
      row({ ...common, account: "Cash on hand", credit: amount }),
    );
  }

  return rows.sort((left, right) => left.date.localeCompare(right.date) || left.entryId.localeCompare(right.entryId));
}

function safeSpreadsheetText(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function quote(value: string) {
  return `"${safeSpreadsheetText(value).replaceAll('"', '""')}"`;
}

export function toAccountingJournalCsv(rows: AccountingJournalRow[], currencyCode: string) {
  const header = ["Date", "Entry ID", "Source", "Account", "Debit", "Credit", "Currency", "Memo", "Reference"];
  return [
    header.join(","),
    ...rows.map((item) => [
      item.date,
      item.entryId,
      item.source,
      item.account,
      item.debit ? item.debit.toFixed(2) : "",
      item.credit ? item.credit.toFixed(2) : "",
      currencyCode,
      item.memo,
      item.reference,
    ].map((value) => quote(String(value))).join(",")),
  ].join("\n");
}
