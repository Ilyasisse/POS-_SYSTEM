import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  averageOrderValue,
  grossProfit,
  netSales,
  ratioPercent,
} from "@/lib/reports/financial-formulas";
import type { ReportRange } from "@/lib/reports/reporting-calendar";
import type { ReportQuery } from "@/lib/reports/validation";

type SalesRow = { name: string; quantity: number; grossSales: Prisma.Decimal; cogs: Prisma.Decimal; missingCostLines: number };
const zero = () => new Prisma.Decimal(0);
const serialize = (value: Prisma.Decimal | null) => value?.toFixed(2) ?? null;
const hourFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  hour12: false,
  timeZone: "Africa/Nairobi",
});

function orderFilters(query: ReportQuery): Prisma.OrderWhereInput {
  return {
    waiterId: query.waiterId,
    cashierId: query.cashierId,
    tableId: query.tableId,
    customerId: query.customerId,
    payments: query.paymentMethod ? { some: { method: query.paymentMethod as never } } : undefined,
    orderItems: query.productId || query.categoryId || query.station
      ? {
          some: {
            productId: query.productId,
            station: query.station as never,
            product: { categoryId: query.categoryId },
          },
        }
      : undefined,
  };
}

function addRow(map: Map<string, SalesRow>, key: string, name: string, input: { qty: number; gross: Prisma.Decimal; cost: Prisma.Decimal | null }) {
  const row = map.get(key) ?? { name, quantity: 0, grossSales: zero(), cogs: zero(), missingCostLines: 0 };
  row.quantity += input.qty;
  row.grossSales = row.grossSales.plus(input.gross);
  if (input.cost == null) row.missingCostLines += 1;
  else row.cogs = row.cogs.plus(input.cost.times(input.qty));
  map.set(key, row);
}

export async function getSalesReport(range: ReportRange, query: ReportQuery) {
  const filters = orderFilters(query);
  const [orders, unpaidOrders, voidedOrders] = await Promise.all([
    prisma.order.findMany({
      where: { ...filters, status: "PAID", closedAt: { gte: range.start, lt: range.end } },
      orderBy: { closedAt: "asc" },
      include: {
        payments: true,
        salesAdjustments: true,
        waiter: { select: { id: true, fullName: true } },
        cashier: { select: { id: true, fullName: true } },
        table: { select: { id: true, name: true } },
        orderItems: {
          include: {
            product: { select: { id: true, name: true, category: { select: { id: true, name: true } } } },
          },
        },
      },
    }),
    prisma.order.count({ where: { ...filters, status: "OPEN", createdAt: { gte: range.start, lt: range.end } } }),
    prisma.order.count({ where: { ...filters, status: "CANCELLED", closedAt: { gte: range.start, lt: range.end } } }),
  ]);

  let gross = zero();
  let discounts = zero();
  let refunds = zero();
  let complimentary = zero();
  let staffMeals = zero();
  let cogs = zero();
  let costCoveredLines = 0;
  let totalLines = 0;
  const paymentTotals = new Map<string, Prisma.Decimal>();
  const productRows = new Map<string, SalesRow>();
  const categoryRows = new Map<string, SalesRow>();
  const hourly = new Map<string, Prisma.Decimal>();

  for (const order of orders) {
    for (const payment of order.payments) paymentTotals.set(payment.method, (paymentTotals.get(payment.method) ?? zero()).plus(payment.amountPaid));
    let orderGross = zero();
    let orderDiscounts = zero();
    let orderRefunds = zero();

    for (const adjustment of order.salesAdjustments) {
      if (adjustment.type === "DISCOUNT") {
        discounts = discounts.plus(adjustment.amount);
        orderDiscounts = orderDiscounts.plus(adjustment.amount);
      } else if (adjustment.type === "REFUND") {
        refunds = refunds.plus(adjustment.amount);
        orderRefunds = orderRefunds.plus(adjustment.amount);
      } else if (adjustment.type === "COMPLIMENTARY") {
        complimentary = complimentary.plus(adjustment.amount);
        orderDiscounts = orderDiscounts.plus(adjustment.amount);
      } else if (adjustment.type === "STAFF_MEAL") {
        staffMeals = staffMeals.plus(adjustment.amount);
        orderDiscounts = orderDiscounts.plus(adjustment.amount);
      }
    }

    for (const item of order.orderItems) {
      gross = gross.plus(item.lineTotal);
      orderGross = orderGross.plus(item.lineTotal);
      totalLines += 1;
      if (item.unitCostSnapshot != null) {
        costCoveredLines += 1;
        cogs = cogs.plus(item.unitCostSnapshot.times(item.qty));
      }
      addRow(productRows, item.productId, item.productName, { qty: item.qty, gross: item.lineTotal, cost: item.unitCostSnapshot });
      addRow(categoryRows, item.product.category.id, item.product.category.name, { qty: item.qty, gross: item.lineTotal, cost: item.unitCostSnapshot });
    }

    const hour = hourFormatter.format(order.closedAt ?? order.createdAt);
    hourly.set(
      hour,
      (hourly.get(hour) ?? zero()).plus(
        netSales(orderGross, orderDiscounts, orderRefunds),
      ),
    );
  }

  const net = netSales(gross, discounts.plus(complimentary).plus(staffMeals), refunds);
  const profit = totalLines > 0 && costCoveredLines === totalLines ? grossProfit(net, cogs) : null;
  const mapRows = (rows: Map<string, SalesRow>) => [...rows.entries()].map(([id, row]) => ({
    id,
    name: row.name,
    quantity: row.quantity,
    grossSales: row.grossSales.toFixed(2),
    cogs: row.missingCostLines === 0 ? row.cogs.toFixed(2) : null,
    grossProfit: row.missingCostLines === 0 ? row.grossSales.minus(row.cogs).toFixed(2) : null,
    missingCostLines: row.missingCostLines,
  })).sort((a, b) => Number(b.grossSales) - Number(a.grossSales));

  return {
    period: { start: range.start.toISOString(), end: range.end.toISOString(), timezone: "Africa/Nairobi" as const, currency: "USD" as const },
    summary: {
      grossSales: gross.toFixed(2), netSales: net.toFixed(2), discounts: discounts.toFixed(2), refunds: refunds.toFixed(2),
      complimentary: complimentary.toFixed(2), staffMeals: staffMeals.toFixed(2), paidOrders: orders.length,
      unpaidOrders, voidedOrders, averageOrderValue: serialize(averageOrderValue(net, orders.length)),
      cogs: costCoveredLines > 0 ? cogs.toFixed(2) : null, grossProfit: serialize(profit),
      grossMargin: profit ? serialize(ratioPercent(profit, net)) : null,
      costCoveragePercent: serialize(ratioPercent(costCoveredLines, totalLines)), costCoveredLines, totalLines,
    },
    paymentMethods: [...paymentTotals.entries()].map(([method, amount]) => ({ method, amount: amount.toFixed(2) })),
    hourlySales: [...hourly.entries()].map(([hour, amount]) => ({ hour, amount: amount.toFixed(2) })).sort((a, b) => Number(a.hour) - Number(b.hour)),
    categories: mapRows(categoryRows), products: mapRows(productRows),
    orders: orders.map((order) => ({ id: order.id, orderNumber: order.orderNumber, closedAt: order.closedAt?.toISOString() ?? null, total: order.total.toFixed(2), waiter: order.waiter?.fullName ?? null, cashier: order.cashier?.fullName ?? null, table: order.table?.name ?? null })),
  };
}
