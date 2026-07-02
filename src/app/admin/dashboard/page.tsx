import { prisma } from "@/lib/prisma";
import Header from "@/components/admin/dashboard/Header";
import Dashboard from "@/components/admin/dashboard/Dashboard";

import Status from "@/components/admin/dashboard/Status";

// Convert UTC TimeZone to my local EAST AFRICA time zone
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

// Represents one full day in milliseconds for date-range calculations.
const DAY_MS = 24 * 60 * 60 * 1000;

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: "Africa/Nairobi",
});

// Returns a new date shifted by a whole number of days.
function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

// Finds the start of the current cafe business day in East Africa Time.
function getEatDayStart(date = new Date()) {
  // REVIEW: Dashboard metrics use the cafe's East Africa Time business day.
  // Shifts the input date into EAT before truncating it to midnight.
  const eatNow = new Date(date.getTime());

  // Stores the UTC timestamp for midnight of the EAT calendar day.
  const eatStart = Date.UTC(
    eatNow.getUTCFullYear(),
    eatNow.getUTCMonth(),
    eatNow.getUTCDate(),
  );

  return new Date(eatStart - EAT_OFFSET_MS);
}

// Finds the Monday start for the current cafe reporting week.
function getEatWeekStart(date = new Date()) {
  // Reuses the EAT day start so weekly ranges align with daily ranges.
  const todayStart = getEatDayStart(date);

  // Shifts the input into EAT for weekday math.
  const eatNow = new Date(date.getTime() + EAT_OFFSET_MS);

  // Converts JavaScript's Sunday-first week into a Monday-first week.
  const daysSinceMonday = (eatNow.getUTCDay() + 6) % 7;

  return addDays(todayStart, -daysSinceMonday);
}

// Renders the admin dashboard page with live Prisma-backed metrics.
export default async function AdminPage() {
  // Defines the start of the current cafe-local day.
  const todayStart = getEatDayStart();

  // Defines the exclusive end of the current cafe-local day.
  const tomorrowStart = addDays(todayStart, 1);

  // Defines the start of the current cafe-local reporting week.
  const weekStart = getEatWeekStart();

  // Defines the exclusive end of the current cafe-local reporting week.
  const weekEnd = addDays(weekStart, 7);

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
  ] = await prisma.$transaction([
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
  ]);

  // Sums weekly order totals for the sales KPI.
  const totalSales = weekOrders.reduce(
    (sum, order) => sum + Number(order.total),
    0,
  );

  // Counts weekly orders for the sales summary.
  const totalOrders = weekOrders.length;

  // Calculates average order value while avoiding division by zero.
  const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

  // Builds seven chart points, one for each day in the current week.
  const chartPoints = Array.from({ length: 7 }, (_, index) => {
    // Defines the inclusive start for this chart day.
    const dayStart = addDays(weekStart, index);

    // Defines the exclusive end for this chart day.
    const dayEnd = addDays(dayStart, 1);

    // Sums orders that fall inside this chart day.
    const value = weekOrders
      .filter(
        (order) => order.createdAt >= dayStart && order.createdAt < dayEnd,
      )
      .reduce((sum, order) => sum + Number(order.total), 0);

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
