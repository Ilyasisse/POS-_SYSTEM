import { prisma } from "@/lib/prisma";
import Header from "@/components/admin/dashboard/Header";
import Dashboard from "@/components/admin/dashboard/Dashboard";
import SupplierPaymentsDue from "@/components/admin/dashboard/SupplierPaymentsDue";

import Status from "@/components/admin/dashboard/Status";
import { summarizeSupplierBillsDue } from "@/lib/suppliers/supplier-bills";
import {
  getBusinessDayRange,
  getReportingWeekRange,
  shiftRange,
} from "@/lib/reports/reporting-calendar";
import {
  averageOrderValue as calculateAverageOrderValue,
  sumMoney,
} from "@/lib/reports/financial-formulas";

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: "Africa/Nairobi",
});

// Renders the admin dashboard page with live Prisma-backed metrics.
export default async function AdminPage() {
  const now = new Date();
  const { start: todayStart, end: tomorrowStart } =
    getBusinessDayRange(now);
  const { start: weekStart, end: weekEnd } = getReportingWeekRange(now);

  const [
    // Total number of menu categories.
    categoryCount,
    // Total number of products.
    productCount,
    // Total number of modifier rows.
    modifierCount,
    // Total staff users, excluding customers.
    staffCount,
    // Orders created during the current cafe-local day.
    todayOrders,
    // Orders created during the current cafe-local week.
    weekOrders,
    // Supply stock alerts for internal inventory.
    lowStockSupplies,
    // Latest orders used by Recent Activity.
    recentOrders,
    // Recently updated products used by Recent Activity.
    recentProducts,
    // Recent inventory movements used by Recent Activity.
    recentMovements,
    // New customer accounts created this week.
    newCustomers,
    // Unsettled finalized-invoice bills due on or before tomorrow.
    supplierBillsDue,
  ] = await Promise.all([
    prisma.category.count(),
    prisma.product.count(),
    prisma.modifier.count(),
    prisma.user.count({
      where: {
        role: {
          not: "CUSTOMER",
        },
      },
    }),

    prisma.order.findMany({
      where: {
        createdAt: {
          gte: todayStart,
          lt: tomorrowStart,
        },
      },
      select: {
        id: true,
        status: true,
        total: true,
      },
    }),
    prisma.order.findMany({
      where: {
        createdAt: {
          gte: weekStart,
          lt: weekEnd,
        },
      },
      select: {
        id: true,
        total: true,
        createdAt: true,
      },
    }),
    prisma.inventorySupply.count({
      where: {
        isActive: true,
        inventoryAlertStatus: {
          in: ["LOW", "OUT"],
        },
      },
    }),
    prisma.order.findMany({
      take: 3,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
      },
    }),
    prisma.product.findMany({
      take: 2,
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
        name: true,
        updatedAt: true,
      },
    }),
    prisma.inventoryMovement.findMany({
      take: 2,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        itemName: true,
        quantityAfter: true,
        createdAt: true,
      },
    }),
    prisma.user.count({
      where: {
        role: "CUSTOMER",
        createdAt: {
          gte: weekStart,
          lt: weekEnd,
        },
      },
    }),
    prisma.supplierBill.findMany({
      where: {
        status: { in: ["UNPAID", "PARTIAL"] },
      },
      select: {
        id: true,
        supplierId: true,
        dueDate: true,
        totalAmount: true,
        paidAmount: true,
        status: true,
        supplier: { select: { name: true } },
        installments: {
          select: {
            dueDate: true,
            amount: true,
            paidAmount: true,
            status: true,
          },
        },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const supplierDueSummary = summarizeSupplierBillsDue(
    supplierBillsDue.map((bill) => ({
      id: bill.id,
      supplierId: bill.supplierId,
      supplierName: bill.supplier.name,
      dueDate: bill.dueDate,
      totalAmount: bill.totalAmount,
      paidAmount: bill.paidAmount,
      status: bill.status,
      installments: bill.installments,
    })),
    now,
  );

  // Sums weekly order totals for the sales KPI.
  const totalSalesDecimal = sumMoney(weekOrders.map((order) => order.total));
  const totalSales = totalSalesDecimal.toNumber();

  // Counts weekly orders for the sales summary.
  const totalOrders = weekOrders.length;

  // Calculates average order value while avoiding division by zero.
  const averageOrderValue =
    calculateAverageOrderValue(totalSalesDecimal, totalOrders)?.toNumber() ?? 0;

  // Builds seven chart points, one for each day in the current week.
  const chartPoints = Array.from({ length: 7 }, (_, index) => {
    // Defines the inclusive start for this chart day.
    const dayStart = shiftRange(
      { start: weekStart, end: weekStart },
      index,
    ).start;

    // Defines the exclusive end for this chart day.
    const dayEnd = new Date(dayStart.getTime() + 22 * 60 * 60 * 1000);

    // Sums orders that fall inside this chart day.
    const dailyTotals = [];
    for (const order of weekOrders) {
      if (order.createdAt >= dayStart && order.createdAt < dayEnd) {
        dailyTotals.push(order.total);
      }
    }
    const value = sumMoney(dailyTotals).toNumber();

    // Formats the chart day label in cafe-local time.
    const label = weekdayFormatter.format(dayStart);

    return { label, value };
  });

  return (
    <div className="mx-auto w-full space-y-6 p-4 pb-12 sm:p-6 lg:p-8">
      <Header
        categoryCount={categoryCount}
        productCount={productCount}
        modifierCount={modifierCount}
        todayOrders={todayOrders}
        staffCount={staffCount}
      />

      <SupplierPaymentsDue summary={supplierDueSummary} />

      <Dashboard
        lowStockSupplies={lowStockSupplies}
        todayOrders={todayOrders}
      />

      <Status
        recentOrders={recentOrders}
        recentProducts={recentProducts}
        recentMovements={recentMovements}
        chartPoints={chartPoints}
        totalSales={totalSales}
        totalOrder={totalOrders}
        averageOrderValue={averageOrderValue}
        newCustomers={newCustomers}
      />
    </div>
  );
}
