import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ReportRange } from "@/lib/reports/reporting-calendar";
import type { ReportQuery } from "@/lib/reports/validation";
import { getSalesReport } from "@/lib/reports/services/sales-report-service";

const zero = () => new Prisma.Decimal(0);
const dateWhere = (range: ReportRange) => ({ gte: range.start, lt: range.end });
const coverage = (availableFrom: Date | null, range: ReportRange) => ({ availableFrom: availableFrom?.toISOString() ?? null, complete: availableFrom ? range.start >= availableFrom : false, note: availableFrom && range.start < availableFrom ? "Earlier history is unavailable and is not estimated." : null });

export async function getInventoryReport(range: ReportRange) {
  const [supplies, events, counts] = await Promise.all([
    prisma.inventorySupply.findMany({ where: { isActive: true }, select: { id: true, name: true, stockQty: true, standardUnitCost: true, quantityCoverage: true } }),
    prisma.stockEvent.groupBy({ by: ["type"], where: { occurredAt: dateWhere(range) }, _sum: { quantityDelta: true }, _count: true }),
    prisma.inventoryCountSession.findMany({ where: { approvedAt: { gte: range.start, lt: range.end } }, include: { lines: true } }),
  ]);
  const valuation = supplies.reduce((sum, supply) => sum.plus(supply.standardUnitCost?.times(supply.stockQty) ?? 0), zero());
  return { period: range, coverage: coverage(new Date("2026-08-08T00:00:00.000Z"), range), valuation: valuation.toFixed(2), supplies: supplies.map((s) => ({ ...s, stockQty: s.stockQty.toFixed(3), standardUnitCost: s.standardUnitCost?.toFixed(6) ?? null })), movements: events.map((e) => ({ type: e.type, quantity: e._sum.quantityDelta?.toFixed(3) ?? "0", count: e._count })), approvedCounts: counts.length };
}

export async function getKitchenReport(range: ReportRange) {
  const [transitions, quality, targets] = await Promise.all([
    prisma.kitchenTransitionEvent.findMany({ where: { occurredAt: dateWhere(range) }, orderBy: { occurredAt: "asc" } }),
    prisma.kitchenQualityEvent.groupBy({ by: ["type", "station"], where: { occurredAt: dateWhere(range) }, _count: true }),
    prisma.kitchenPreparationTarget.findMany(),
  ]);
  const starts = new Map<string, Date>(); const durations: number[] = [];
  for (const event of transitions) { const key = `${event.orderId}:${event.station ?? "pickup"}`; if (event.type === "STATION_STARTED") starts.set(key, event.occurredAt); if (event.type === "STATION_COMPLETED" && starts.has(key)) durations.push((event.occurredAt.getTime() - starts.get(key)!.getTime()) / 60_000); }
  return { period: range, coverage: coverage(new Date("2026-08-09T00:00:00.000Z"), range), averagePreparationMinutes: durations.length ? (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1) : null, targets: targets.map((x) => ({ station: x.station, targetMinutes: x.targetMinutes })), quality: quality.map((x) => ({ station: x.station, type: x.type, count: x._count })) };
}

export async function getStaffReport(range: ReportRange) {
  const [attendance, payroll, staff] = await Promise.all([
    prisma.attendanceRecord.groupBy({ by: ["status"], where: { businessDate: dateWhere(range) }, _count: true, _sum: { lateMinutes: true, approvedOvertimeMinutes: true } }),
    prisma.payrollLine.aggregate({ where: { payrollRun: { status: "FINALIZED", periodStart: { gte: range.start }, periodEnd: { lte: range.end } } }, _sum: { netPay: true } }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, fullName: true, role: true } }),
  ]);
  return { period: range, coverage: coverage(new Date("2026-08-10T00:00:00.000Z"), range), attendance: attendance.map((x) => ({ status: x.status, count: x._count, lateMinutes: x._sum.lateMinutes ?? 0, overtimeMinutes: x._sum.approvedOvertimeMinutes ?? 0 })), staff, payrollCost: payroll._sum.netPay?.toFixed(2) ?? "0.00" };
}

export async function getCustomerReport(range: ReportRange) {
  const [orders, feedback, complaints] = await Promise.all([
    prisma.order.findMany({ where: { status: "PAID", closedAt: dateWhere(range), customerId: { not: null } }, select: { customerId: true, total: true, closedAt: true } }),
    prisma.customerFeedback.aggregate({ where: { createdAt: dateWhere(range), rating: { not: null } }, _avg: { rating: true }, _count: true }),
    prisma.complaintCase.groupBy({ by: ["status"], where: { createdAt: dateWhere(range) }, _count: true }),
  ]);
  const customers = new Map<string, { visits: number; spend: Prisma.Decimal }>(); for (const order of orders) { const key = order.customerId!; const row = customers.get(key) ?? { visits: 0, spend: zero() }; row.visits++; row.spend = row.spend.plus(order.total); customers.set(key, row); }
  return { period: range, coverage: { identifiedOrdersOnly: true, ...coverage(null, range) }, identifiedCustomers: customers.size, repeatCustomers: [...customers.values()].filter((x) => x.visits > 1).length, lifetimeSpendInPeriod: orders.reduce((sum, x) => sum.plus(x.total), zero()).toFixed(2), averageRating: feedback._avg.rating, ratings: feedback._count, complaints: complaints.map((x) => ({ status: x.status, count: x._count })) };
}

export async function getSupplierReport(range: ReportRange) {
  const [orders, receiving, bills] = await Promise.all([prisma.supplierPurchaseOrder.findMany({ where: { createdAt: dateWhere(range) }, include: { receiving: true } }), prisma.supplierReceiving.findMany({ where: { receivedAt: dateWhere(range) } }), prisma.supplierBill.aggregate({ where: { createdAt: dateWhere(range) }, _sum: { totalAmount: true, paidAmount: true } })]);
  const onTime = orders.filter((x) => x.receiving && x.receiving.receivedAt <= x.expectedDeliveryDate).length;
  return { period: range, coverage: coverage(new Date("2026-08-10T00:00:00.000Z"), range), purchaseOrders: orders.length, emergencyPurchases: orders.filter((x) => x.emergencyPurchase).length, received: receiving.length, onTime, bills: { total: bills._sum.totalAmount?.toFixed(2) ?? "0.00", paid: bills._sum.paidAmount?.toFixed(2) ?? "0.00" } };
}

export async function getFinanceReport(range: ReportRange, query: ReportQuery) {
  const [sales, expenses, withdrawals, payroll] = await Promise.all([getSalesReport(range, query), prisma.expenseTransaction.aggregate({ where: { status: "APPROVED", paidAt: dateWhere(range) }, _sum: { amount: true } }), prisma.ownerWithdrawal.aggregate({ where: { withdrawnAt: dateWhere(range) }, _sum: { amount: true } }), prisma.payrollLine.aggregate({ where: { payrollRun: { status: "FINALIZED", periodStart: { gte: range.start }, periodEnd: { lte: range.end } } }, _sum: { netPay: true } })]);
  const revenue = new Prisma.Decimal(sales.summary.netSales); const cogs = sales.summary.cogs ? new Prisma.Decimal(sales.summary.cogs) : null; const labour = payroll._sum.netPay ?? zero(); const expense = expenses._sum.amount ?? zero(); const netProfit = cogs ? revenue.minus(cogs).minus(labour).minus(expense) : null;
  return { period: range, coverage: { cogs: sales.summary.costCoveragePercent, ...coverage(new Date("2026-08-08T00:00:00.000Z"), range) }, revenue: revenue.toFixed(2), cogs: cogs?.toFixed(2) ?? null, labour: labour.toFixed(2), expenses: expense.toFixed(2), netProfit: netProfit?.toFixed(2) ?? null, withdrawals: (withdrawals._sum.amount ?? zero()).toFixed(2), recordedCashReserve: revenue.minus(expense).minus(labour).minus(withdrawals._sum.amount ?? zero()).toFixed(2) };
}

export async function getOperationsReport(range: ReportRange) {
  const [incidents, cleaning] = await Promise.all([prisma.operationalIncident.findMany({ where: { startedAt: dateWhere(range) } }), prisma.cleaningChecklistRun.groupBy({ by: ["status"], where: { scheduledFor: dateWhere(range) }, _count: true })]);
  return { period: range, coverage: coverage(new Date("2026-08-09T00:00:00.000Z"), range), incidents: incidents.map((x) => ({ type: x.type, severity: x.severity, durationMinutes: x.resolvedAt ? Math.max(0, (x.resolvedAt.getTime() - x.startedAt.getTime()) / 60_000) : null })), cleaning: cleaning.map((x) => ({ status: x.status, count: x._count })) };
}
