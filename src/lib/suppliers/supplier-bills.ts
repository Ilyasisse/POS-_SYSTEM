import {
  getSupplierBillDefaultDueDateKey,
  getSupplierPurchaseTodayDateKey,
  supplierPurchaseDateKeyToDatabaseDate,
} from "@/lib/suppliers/purchase-orders";

export type SupplierBillDueState =
  | "overdue"
  | "today"
  | "tomorrow"
  | "future";

export type SupplierBillDueInput = {
  id: string;
  supplierId: string;
  supplierName: string;
  dueDate: Date;
  totalAmount: { toString(): string } | number | string;
  paidAmount: { toString(): string } | number | string;
  status: "UNPAID" | "PARTIAL" | "PAID";
  installments?: Array<{
    dueDate: Date;
    amount: { toString(): string } | number | string;
    paidAmount: { toString(): string } | number | string;
    status: "UNPAID" | "PARTIAL" | "PAID";
  }>;
};

export type SupplierDueSummaryRow = {
  supplierId: string;
  supplierName: string;
  billCount: number;
  totalRemaining: number;
  overdueRemaining: number;
  dueTodayRemaining: number;
  dueTomorrowRemaining: number;
  oldestDueDateKey: string;
};

export type SupplierDueSummary = {
  suppliers: SupplierDueSummaryRow[];
  supplierCount: number;
  billCount: number;
  totalRemaining: number;
  overdueRemaining: number;
  dueTodayRemaining: number;
  dueTomorrowRemaining: number;
  todayDateKey: string;
  tomorrowDateKey: string;
};

type MutableSupplierDueSummaryRow = {
  supplierId: string;
  supplierName: string;
  billCount: number;
  oldestDueDateKey: string;
  totalRemainingCents: number;
  overdueRemainingCents: number;
  dueTodayRemainingCents: number;
  dueTomorrowRemainingCents: number;
};

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function currencyCents(value: SupplierBillDueInput["totalAmount"]) {
  const amount = Number(value.toString());
  if (!Number.isFinite(amount)) {
    throw new Error("Supplier bill contains an invalid currency amount.");
  }
  return Math.round(amount * 100);
}

export function getSupplierBillDueCutoffDate(now = new Date()) {
  const cutoff = supplierPurchaseDateKeyToDatabaseDate(
    getSupplierBillDefaultDueDateKey(now),
  );
  if (!cutoff) throw new Error("Unable to calculate the supplier bill cutoff.");
  return cutoff;
}

export function getSupplierBillDueState(
  dueDate: Date,
  now = new Date(),
): SupplierBillDueState {
  const dueDateKey = dateKey(dueDate);
  const todayDateKey = getSupplierPurchaseTodayDateKey(now);
  const tomorrowDateKey = getSupplierBillDefaultDueDateKey(now);

  if (dueDateKey < todayDateKey) return "overdue";
  if (dueDateKey === todayDateKey) return "today";
  if (dueDateKey === tomorrowDateKey) return "tomorrow";
  return "future";
}

export function summarizeSupplierBillsDue(
  bills: readonly SupplierBillDueInput[],
  now = new Date(),
): SupplierDueSummary {
  const todayDateKey = getSupplierPurchaseTodayDateKey(now);
  const tomorrowDateKey = getSupplierBillDefaultDueDateKey(now);
  const supplierRows = new Map<string, MutableSupplierDueSummaryRow>();

  let billCount = 0;
  let totalRemainingCents = 0;
  let overdueRemainingCents = 0;
  let dueTodayRemainingCents = 0;
  let dueTomorrowRemainingCents = 0;

  for (const bill of bills) {
    const obligations = bill.installments?.length
      ? bill.installments
      : [{ dueDate: bill.dueDate, amount: bill.totalAmount, paidAmount: bill.paidAmount, status: bill.status }];
    let countedBill = false;
    for (const obligation of obligations) {
      if (obligation.status === "PAID") continue;
      const dueState = getSupplierBillDueState(obligation.dueDate, now);
      if (dueState === "future") continue;
      const remainingCents = Math.max(0, currencyCents(obligation.amount) - currencyCents(obligation.paidAmount));
      if (!remainingCents) continue;
      const dueDateKey = dateKey(obligation.dueDate);
      const row = supplierRows.get(bill.supplierId) ?? {
        supplierId: bill.supplierId, supplierName: bill.supplierName, billCount: 0,
        oldestDueDateKey: dueDateKey, totalRemainingCents: 0, overdueRemainingCents: 0,
        dueTodayRemainingCents: 0, dueTomorrowRemainingCents: 0,
      };
      if (!countedBill) { row.billCount += 1; billCount += 1; countedBill = true; }
      row.totalRemainingCents += remainingCents;
      row.oldestDueDateKey = dueDateKey < row.oldestDueDateKey ? dueDateKey : row.oldestDueDateKey;
      if (dueState === "overdue") { row.overdueRemainingCents += remainingCents; overdueRemainingCents += remainingCents; }
      if (dueState === "today") { row.dueTodayRemainingCents += remainingCents; dueTodayRemainingCents += remainingCents; }
      if (dueState === "tomorrow") { row.dueTomorrowRemainingCents += remainingCents; dueTomorrowRemainingCents += remainingCents; }
      supplierRows.set(bill.supplierId, row);
      totalRemainingCents += remainingCents;
    }
  }

  const suppliers = Array.from(supplierRows.values(), (row) => ({
    supplierId: row.supplierId,
    supplierName: row.supplierName,
    billCount: row.billCount,
    oldestDueDateKey: row.oldestDueDateKey,
    totalRemaining: row.totalRemainingCents / 100,
    overdueRemaining: row.overdueRemainingCents / 100,
    dueTodayRemaining: row.dueTodayRemainingCents / 100,
    dueTomorrowRemaining: row.dueTomorrowRemainingCents / 100,
  })).sort(
    (first, second) =>
      second.overdueRemaining - first.overdueRemaining ||
      second.totalRemaining - first.totalRemaining ||
      first.supplierName.localeCompare(second.supplierName),
  );

  return {
    suppliers,
    supplierCount: suppliers.length,
    billCount,
    totalRemaining: totalRemainingCents / 100,
    overdueRemaining: overdueRemainingCents / 100,
    dueTodayRemaining: dueTodayRemainingCents / 100,
    dueTomorrowRemaining: dueTomorrowRemainingCents / 100,
    todayDateKey,
    tomorrowDateKey,
  };
}
