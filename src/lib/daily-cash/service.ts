import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { businessDateKeyToDatabaseDate } from "@/lib/waiter/waiter-balance-calculations";
import { recordSupplierPaymentInTransaction, revertSupplierPayment } from "@/lib/suppliers/bill-service";
import { formatSupplierInvoiceNumber } from "@/lib/suppliers/invoice-number";
import {
  assertDailyCashBusinessDate,
  getDailyCashWaiterBalanceDateKey,
  isDailyCashLocked,
} from "./business-date";
import { dailyCashFingerprint } from "./fingerprint";
import { calculateDailyCashSummary, fundingFor, roundMoney } from "./money";
import { buildDailyCashPaidBreakdown, calculatePaidBreakdownTotals } from "./paid-breakdown";
import { resolveDailySalaryRate } from "./salary-rates";
import { summarizeDailyCashShiftCash } from "./shift-cash";
import { selectDailyCashObligations, validateSupplierObligationPaymentAmount } from "./supplier-obligations";
import type { DailyCashActionResult, DailyCashStatus } from "./types";

type Tx = Prisma.TransactionClient;
type TransactionQuery = () => PromiseLike<unknown>;
type TransactionQueryResults<Queries extends readonly TransactionQuery[]> = {
  [Index in keyof Queries]: Awaited<ReturnType<Queries[Index]>>;
};

const DAILY_CASH_TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5_000,
  timeout: 15_000,
} as const;

async function runTransactionQueriesSequentially<
  Queries extends readonly TransactionQuery[],
>(queries: Queries): Promise<TransactionQueryResults<Queries>> {
  const results: unknown[] = [];
  for (const query of queries) {
    results.push(await query());
  }
  return results as TransactionQueryResults<Queries>;
}

const number = (value: { toString(): string } | number | null | undefined) => Number(value?.toString() ?? 0);

async function materializeDay(tx: Tx, dateKey: string) {
  const businessDate = businessDateKeyToDatabaseDate(dateKey);
  const rates = await tx.dailySalaryRate.findMany({ orderBy: { effectiveBusinessDate: "desc" } });
  const rate = resolveDailySalaryRate(businessDate, rates);
  if (!rate) return null;
  return tx.dailyCashDay.upsert({
    where: { businessDate },
    create: { businessDate, salaryAmount: rate.amount, salaryRateId: rate.id },
    update: {},
    include: {
      manualExpenses: { orderBy: { createdAt: "asc" } },
      supplierPayments: {
        include: {
          supplierPayment: {
            include: {
              supplier: { select: { name: true } },
              allocations: {
                select: {
                  bill: { select: { invoice: { select: { invoiceNumber: true } } } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      supplyPayments: {
        include: { supplyDay: { select: { purchaseDate: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

async function currentState(tx: Tx, dateKey: string) {
  const day = await materializeDay(tx, dateKey);
  if (!day) return null;
  const businessDate = businessDateKeyToDatabaseDate(dateKey);
  const waiterBalanceDateKey = getDailyCashWaiterBalanceDateKey(dateKey);
  const waiterBalanceDate = businessDateKeyToDatabaseDate(
    waiterBalanceDateKey,
  );
  // Interactive transactions use one pg client, so these independent reads
  // must be issued sequentially even though they would normally be parallel.
  const [shifts, activeWaiters, bills, suppliers, supplyDays] =
    await runTransactionQueriesSequentially([
      () =>
        tx.shift.findMany({
          where: { businessDate: waiterBalanceDate },
          select: { id: true, userId: true, closingAmount: true },
        }),
      () =>
        tx.user.findMany({
          where: { role: "WAITER", isActive: true },
          select: { id: true, fullName: true },
        }),
      () =>
        tx.supplierBill.findMany({
          where: {
            status: { in: ["UNPAID", "PARTIAL"] },
            invoice: { status: "FINALIZED" },
          },
          include: {
            supplier: { select: { name: true } },
            invoice: { select: { invoiceNumber: true } },
            installments: {
              orderBy: [{ dueDate: "asc" }, { sequence: "asc" }],
            },
          },
        }),
      () =>
        tx.supplier.findMany({
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            payments: {
              select: {
                amount: true,
                allocations: { select: { amount: true } },
              },
            },
          },
          orderBy: { name: "asc" },
        }),
      () =>
        tx.supplyDay.findMany({
          where: {
            closedAt: { not: null },
            purchaseDate: { lt: businessDate },
          },
          include: {
            payments: {
              where: {
                dailyCashDay: { businessDate: { lte: businessDate } },
              },
              select: { amount: true },
            },
          },
          orderBy: { purchaseDate: "asc" },
        }),
    ] as const);
  const shiftCash = summarizeDailyCashShiftCash(
    shifts.map((shift) => ({
      id: shift.id,
      userId: shift.userId,
      closingAmount:
        shift.closingAmount === null ? null : number(shift.closingAmount),
    })),
    activeWaiters,
  );
  const { endDayCash, missingWaiters } = shiftCash;
  const obligations = selectDailyCashObligations(bills);
  const supplierAccounts = suppliers.map((supplier) => ({
    id: supplier.id,
    name: supplier.name,
    credit: roundMoney(
      supplier.payments.reduce(
        (sum, payment) =>
          sum +
          number(payment.amount) -
          payment.allocations.reduce(
            (allocationSum, allocation) =>
              allocationSum + number(allocation.amount),
            0,
          ),
        0,
      ),
    ),
  }));
  const supplyObligations = [];
  for (const row of supplyDays) {
    const originalTotal = number(row.closedTotal);
    const paidAmount = roundMoney(row.payments.reduce((sum, payment) => sum + number(payment.amount), 0));
    const dueDate = new Date(row.purchaseDate);
    dueDate.setUTCDate(dueDate.getUTCDate() + 1);
    const amount = roundMoney(originalTotal - paidAmount);
    if (amount > 0) supplyObligations.push({ supplyDayId: row.id, purchaseDate: row.purchaseDate, dueDate, originalTotal, paidAmount, amount });
  }
  const salaryPaid = day.salaryPaidAt !== null || number(day.salaryAmount) === 0;
  const paidRevenueFunded = number(day.salaryRevenueFunded) + day.manualExpenses.reduce((sum, row) => sum + number(row.revenueFunded), 0) + day.supplierPayments.reduce((sum, row) => sum + number(row.revenueFunded), 0) + day.supplyPayments.reduce((sum, row) => sum + number(row.revenueFunded), 0);
  const paidSavingsFunded = number(day.salarySavingsFunded) + day.manualExpenses.reduce((sum, row) => sum + number(row.savingsFunded), 0) + day.supplierPayments.reduce((sum, row) => sum + number(row.savingsFunded), 0) + day.supplyPayments.reduce((sum, row) => sum + number(row.savingsFunded), 0);
  const unpaidRequired = (salaryPaid ? 0 : number(day.salaryAmount)) + obligations.reduce((sum, row) => sum + row.amount, 0) + supplyObligations.reduce((sum, row) => sum + row.amount, 0);
  const summary = calculateDailyCashSummary({ revenue: endDayCash, paidRevenueFunded, paidSavingsFunded, unpaidRequired });
  const paidBreakdownRows = buildDailyCashPaidBreakdown({
    dayId: day.id,
    salary: {
      amount: number(day.salaryAmount),
      paidAt: day.salaryPaidAt,
      revenueFunded: number(day.salaryRevenueFunded),
      savingsFunded: number(day.salarySavingsFunded),
    },
    manualExpenses: day.manualExpenses.map((row) => ({
      id: row.id,
      description: row.description,
      note: row.note,
      amount: number(row.amount),
      revenueFunded: number(row.revenueFunded),
      savingsFunded: number(row.savingsFunded),
      createdAt: row.createdAt,
    })),
    supplierPayments: day.supplierPayments.map((row) => ({
      id: row.id,
      supplierName: row.supplierPayment.supplier.name,
      invoiceNumber: (() => {
        const invoiceNumbers = [
          ...new Set(
            row.supplierPayment.allocations.map(
              (allocation) =>
                formatSupplierInvoiceNumber(
                  allocation.bill.invoice.invoiceNumber,
                ),
            ),
          ),
        ];
        if (!invoiceNumbers.length) return "Advance / future credit";
        if (invoiceNumbers.length === 1) return invoiceNumbers[0];
        return `${invoiceNumbers.length} invoices`;
      })(),
      amount: number(row.amount),
      revenueFunded: number(row.revenueFunded),
      savingsFunded: number(row.savingsFunded),
      paidAt: row.supplierPayment.paidAt,
    })),
    supplyPayments: day.supplyPayments.map((row) => ({
      id: row.id,
      purchaseDate: row.supplyDay.purchaseDate,
      amount: number(row.amount),
      revenueFunded: number(row.revenueFunded),
      savingsFunded: number(row.savingsFunded),
      paidAt: row.createdAt,
    })),
  });
  const paidBreakdownTotals = calculatePaidBreakdownTotals(endDayCash, paidBreakdownRows);
  const fingerprint = dailyCashFingerprint({
    dateKey,
    waiterBalanceDateKey,
    shifts: shiftCash.fingerprintRows,
    missing: missingWaiters.map((waiter) => waiter.id).sort(),
    salary: [number(day.salaryAmount), day.salaryOverridden, day.salaryPaidAt?.toISOString() ?? null, number(day.salaryRevenueFunded), number(day.salarySavingsFunded)],
    manual: day.manualExpenses.map((row) => [row.id, row.description, row.note, number(row.amount), number(row.revenueFunded), number(row.savingsFunded)]),
    payments: day.supplierPayments.map((row) => [row.id, row.supplierPaymentId, number(row.amount), number(row.revenueFunded), number(row.savingsFunded)]),
    supplyPayments: day.supplyPayments.map((row) => [row.id, row.supplyDayId, number(row.amount), number(row.revenueFunded), number(row.savingsFunded)]),
    supplyObligations: supplyObligations.map((row) => [row.supplyDayId, row.purchaseDate.toISOString(), row.originalTotal, row.paidAmount, row.amount]),
    obligations: obligations.map((row) => [row.billId, row.installmentId, row.dueDate.toISOString(), row.amount]),
  });
  const locked = isDailyCashLocked(dateKey);
  const status: DailyCashStatus = locked ? "LOCKED" : !day.finalizedAt ? "OPEN" : day.finalizationFingerprint === fingerprint ? "FINALIZED" : "NEEDS_REVIEW";
  return { day, waiterBalanceDateKey, endDayCash, missingWaiters, obligations, supplierAccounts, supplyObligations, salaryPaid, paidRevenueFunded, paidSavingsFunded, unpaidRequired, summary, paidBreakdownRows, paidBreakdownTotals, fingerprint, status, locked };
}

export async function getDailyCash(dateKey: string, now = new Date()) {
  const valid = assertDailyCashBusinessDate(dateKey, now);
  return prisma.$transaction(
    (tx) => currentState(tx, valid),
    DAILY_CASH_TRANSACTION_OPTIONS,
  );
}

async function mutate<T>(dateKey: string, now: Date, fn: (tx: Tx, state: NonNullable<Awaited<ReturnType<typeof currentState>>>) => Promise<T>) {
  const valid = assertDailyCashBusinessDate(dateKey, now);
  if (isDailyCashLocked(valid, now)) throw new Error("This Daily Cash day is permanently locked.");
  return prisma.$transaction(async (tx) => {
    const state = await currentState(tx, valid);
    if (!state) throw new Error("Set a salary rate before using Daily Cash.");
    return fn(tx, state);
  }, DAILY_CASH_TRANSACTION_OPTIONS);
}

export async function createDailySalaryRate(input: { amount: number; effectiveDate: string; userId: string }) {
  if (!Number.isFinite(input.amount) || input.amount < 0) throw new Error("Salary amount must be zero or more.");
  const date = assertDailyCashBusinessDate(input.effectiveDate);
  return prisma.dailySalaryRate.upsert({ where: { effectiveBusinessDate: businessDateKeyToDatabaseDate(date) }, create: { amount: input.amount, effectiveBusinessDate: businessDateKeyToDatabaseDate(date), createdByUserId: input.userId }, update: { amount: input.amount, createdByUserId: input.userId } });
}

export async function overrideDailySalary(input: { dateKey: string; amount: number; userId: string }) {
  if (!Number.isFinite(input.amount) || input.amount < 0) throw new Error("Salary amount must be zero or more.");
  return mutate(input.dateKey, new Date(), async (tx, state) => {
    if (state.salaryPaid) throw new Error("A paid salary cannot be changed.");
    await tx.dailyCashDay.update({ where: { id: state.day.id }, data: { salaryAmount: input.amount, salaryOverridden: true, salaryOverriddenAt: new Date(), salaryOverriddenByUserId: input.userId } });
  });
}

export async function payDailySalary(input: { dateKey: string; userId: string; confirmSavings: boolean }): Promise<DailyCashActionResult> {
  return mutate(input.dateKey, new Date(), async (tx, state) => {
    if (state.salaryPaid) throw new Error("Salary is already paid.");
    const amount = number(state.day.salaryAmount);
    const funding = fundingFor(amount, state.summary.cashAvailableNow);
    if (funding.savingsFunded > 0 && !input.confirmSavings) return { ok: false, code: "SAVINGS_CONFIRMATION_REQUIRED", savingsAmount: funding.savingsFunded.toFixed(2) };
    await tx.dailyCashDay.update({ where: { id: state.day.id }, data: { salaryPaidAt: new Date(), salaryPaidByUserId: input.userId, salaryRevenueFunded: funding.revenueFunded, salarySavingsFunded: funding.savingsFunded } });
    return { ok: true };
  });
}

export async function undoDailySalary(input: { dateKey: string }) {
  return mutate(input.dateKey, new Date(), async (tx, state) => {
    if (!state.day.salaryPaidAt) throw new Error("Salary payment not found.");
    await tx.dailyCashDay.update({
      where: { id: state.day.id },
      data: {
        salaryPaidAt: null,
        salaryPaidByUserId: null,
        salaryRevenueFunded: 0,
        salarySavingsFunded: 0,
      },
    });
  });
}

export async function createManualExpense(input: { dateKey: string; description: string; amount: number; note?: string; userId: string; confirmSavings: boolean }): Promise<DailyCashActionResult> {
  if (!input.description.trim() || !Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Enter an expense name and positive amount.");
  return mutate(input.dateKey, new Date(), async (tx, state) => {
    const funding = fundingFor(input.amount, state.summary.cashAvailableNow);
    if (funding.savingsFunded > 0 && !input.confirmSavings) return { ok: false, code: "SAVINGS_CONFIRMATION_REQUIRED", savingsAmount: funding.savingsFunded.toFixed(2) };
    await tx.dailyCashManualExpense.create({ data: { dailyCashDayId: state.day.id, description: input.description.trim(), amount: input.amount, note: input.note?.trim() || null, revenueFunded: funding.revenueFunded, savingsFunded: funding.savingsFunded, createdByUserId: input.userId } });
    return { ok: true };
  });
}

export async function deleteManualExpense(input: { dateKey: string; id: string }) {
  return mutate(input.dateKey, new Date(), async (tx, state) => {
    const result = await tx.dailyCashManualExpense.deleteMany({ where: { id: input.id, dailyCashDayId: state.day.id } });
    if (result.count !== 1) throw new Error("One-time expense not found.");
  });
}

export async function undoDailyCashSupplierPayment(input: { dateKey: string; id: string }) {
  const now = new Date();
  const dateKey = assertDailyCashBusinessDate(input.dateKey, now);
  if (isDailyCashLocked(dateKey, now)) throw new Error("This Daily Cash day is permanently locked.");
  const linkedPayment = await prisma.dailyCashSupplierPayment.findFirst({
    where: {
      id: input.id,
      dailyCashDay: { businessDate: businessDateKeyToDatabaseDate(dateKey) },
    },
    select: { supplierPaymentId: true },
  });
  if (!linkedPayment) throw new Error("Supplier payment not found for this business day.");
  return revertSupplierPayment(linkedPayment.supplierPaymentId, {
    canManageDailyCash: true,
    now,
  });
}

export async function payDailyCashObligation(input: { dateKey: string; billId: string; installmentId?: string | null; amount: number; userId: string; confirmSavings: boolean; allowOverpayment: boolean }): Promise<DailyCashActionResult> {
  return mutate(input.dateKey, new Date(), async (tx, state) => {
    const obligation = state.obligations.find((row) => row.billId === input.billId && row.installmentId === (input.installmentId || null));
    if (!obligation) return { ok: false, code: "STALE_OBLIGATION", message: "This supplier obligation is no longer available." };
    const amount = validateSupplierObligationPaymentAmount(input.amount, obligation.amount, input.allowOverpayment);
    const funding = fundingFor(amount, state.summary.cashAvailableNow);
    if (funding.savingsFunded > 0 && !input.confirmSavings) return { ok: false, code: "SAVINGS_CONFIRMATION_REQUIRED", savingsAmount: funding.savingsFunded.toFixed(2) };
    const result = await recordSupplierPaymentInTransaction(tx, { supplierId: obligation.supplierId, preferredBillId: obligation.billId, preferredInstallmentId: obligation.installmentId, recordedByUserId: input.userId, amount, paymentMethod: "DAILY_CASH", allowOverpayment: input.allowOverpayment });
    await tx.dailyCashSupplierPayment.create({ data: { dailyCashDayId: state.day.id, supplierPaymentId: result.payment.id, amount, revenueFunded: funding.revenueFunded, savingsFunded: funding.savingsFunded, recordedByUserId: input.userId } });
    return { ok: true };
  });
}

export async function payDailyCashSupplierAdvance(input: { dateKey: string; supplierId: string; amount: number; userId: string; confirmSavings: boolean }): Promise<DailyCashActionResult> {
  return mutate(input.dateKey, new Date(), async (tx, state) => {
    const amount = roundMoney(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, code: "VALIDATION_ERROR", message: "Enter a payment amount greater than zero." };
    }
    const funding = fundingFor(amount, state.summary.cashAvailableNow);
    if (funding.savingsFunded > 0 && !input.confirmSavings) {
      return { ok: false, code: "SAVINGS_CONFIRMATION_REQUIRED", savingsAmount: funding.savingsFunded.toFixed(2) };
    }
    const result = await recordSupplierPaymentInTransaction(tx, { supplierId: input.supplierId, recordedByUserId: input.userId, amount, paymentMethod: "DAILY_CASH", allowOverpayment: true });
    await tx.dailyCashSupplierPayment.create({ data: { dailyCashDayId: state.day.id, supplierPaymentId: result.payment.id, amount, revenueFunded: funding.revenueFunded, savingsFunded: funding.savingsFunded, recordedByUserId: input.userId } });
    return { ok: true };
  });
}

export async function payDailyCashSupply(input: { dateKey: string; supplyDayId: string; amount: number; userId: string; confirmSavings: boolean }): Promise<DailyCashActionResult> {
  return mutate(input.dateKey, new Date(), async (tx, state) => {
    const obligation = state.supplyObligations.find((row) => row.supplyDayId === input.supplyDayId);
    if (!obligation) return { ok: false, code: "STALE_OBLIGATION", message: "This supply balance is no longer available." };
    const amount = validateSupplierObligationPaymentAmount(input.amount, obligation.amount);
    const funding = fundingFor(amount, state.summary.cashAvailableNow);
    if (funding.savingsFunded > 0 && !input.confirmSavings) return { ok: false, code: "SAVINGS_CONFIRMATION_REQUIRED", savingsAmount: funding.savingsFunded.toFixed(2) };
    await tx.dailyCashSupplyPayment.create({ data: { dailyCashDayId: state.day.id, supplyDayId: obligation.supplyDayId, amount, revenueFunded: funding.revenueFunded, savingsFunded: funding.savingsFunded, recordedByUserId: input.userId } });
    return { ok: true };
  });
}

export async function undoDailyCashSupplyPayment(input: { dateKey: string; id: string }) {
  return mutate(input.dateKey, new Date(), async (tx, state) => {
    const result = await tx.dailyCashSupplyPayment.deleteMany({ where: { id: input.id, dailyCashDayId: state.day.id } });
    if (result.count !== 1) throw new Error("Supply payment not found.");
  });
}

export async function finalizeDailyCash(input: { dateKey: string; userId: string }) {
  return mutate(input.dateKey, new Date(), async (tx, state) => {
    await tx.dailyCashDay.update({ where: { id: state.day.id }, data: { finalizedAt: new Date(), finalizedByUserId: input.userId, finalizationFingerprint: state.fingerprint, finalizedRevenue: state.endDayCash, finalizedPaidExpenses: state.paidRevenueFunded + state.paidSavingsFunded, finalizedUnpaidRequired: state.unpaidRequired, finalizedRemainingCash: state.summary.projectedRemaining, finalizedSavingsUsed: state.summary.savingsUsed, finalizedAdditionalSavingsRequired: state.summary.additionalSavingsRequired } });
  });
}
