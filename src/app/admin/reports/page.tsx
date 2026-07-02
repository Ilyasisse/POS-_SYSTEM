import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import {
  Button,
  Card,
  AdminPage,
  MetricCard,
  ToneBadge,
} from "@/components/admin/shared";
import { prisma } from "@/lib/prisma";
import { buildWaiterShiftSummary } from "@/lib/waiter/waiter-shifts";
import {
  formatCashierBusinessDayRange,
  getCashierBusinessDayRange,
} from "@/lib/cashier/cashier-business-day";
import { Search } from "lucide-react";

type AdminReportsPageProps = {
  searchParams?: Promise<{
    waiterId?: string;
    date?: string;
  }>;
};

function formatMoney(value: number | null | undefined) {
  if (value == null) return "--";
  return `$${value.toFixed(2)}`;
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInput(dateInput?: string) {
  if (!dateInput) return new Date();
  const [year, month, day] = dateInput.split("-").map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function MiniLineChart({ value }: { value: number }) {
  const points = [
    28,
    36,
    44,
    58,
    50,
    62,
    Math.max(42, Math.min(value / 10, 88)),
    70,
  ];
  const path = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${index * 58 + 16} ${110 - point}`,
    )
    .join(" ");

  return (
    <svg viewBox="0 0 440 130" className="h-56 w-full">
      <path d={`${path} L 422 118 L 16 118 Z`} fill="#dbeafe" opacity="0.65" />
      <path
        d={path}
        fill="none"
        stroke="#2563eb"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {points.map((point, index) => (
        <circle
          key={index}
          cx={index * 58 + 16}
          cy={110 - point}
          r="4"
          fill="#2563eb"
        />
      ))}
    </svg>
  );
}

export default async function AdminReportsPage({
  searchParams,
}: AdminReportsPageProps) {
  const params = await searchParams;
  const anchorDate = parseDateInput(params?.date);
  const { start: businessDayStart, end: businessDayEnd } =
    getCashierBusinessDayRange(anchorDate);
  const selectedDate = formatDateInput(businessDayStart);
  const businessDayLabel = formatCashierBusinessDayRange(
    businessDayStart,
    businessDayEnd,
  );

  const waiters = await prisma.user.findMany({
    where: {
      role: "WAITER",
      isActive: true,
    },
    select: {
      id: true,
      fullName: true,
    },
    orderBy: {
      fullName: "asc",
    },
  });
  const selectedWaiterId = waiters.some(
    (waiter) => waiter.id === params?.waiterId,
  )
    ? (params?.waiterId ?? "")
    : (waiters[0]?.id ?? "");
  const selectedWaiter =
    waiters.find((waiter) => waiter.id === selectedWaiterId) ?? null;

  const [dailyAggregate, categoryRows, reportData] = await Promise.all([
    prisma.order.aggregate({
      where: {
        createdAt: {
          gte: businessDayStart,
          lt: businessDayEnd,
        },
      },
      _sum: {
        total: true,
      },
      _count: {
        id: true,
      },
    }),
    prisma.category.findMany({
      take: 5,
      orderBy: {
        products: {
          _count: "desc",
        },
      },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    }),
    selectedWaiterId
      ? Promise.all([
          prisma.shift.findFirst({
            where: {
              userId: selectedWaiterId,
              openedAt: {
                gte: businessDayStart,
                lt: businessDayEnd,
              },
            },
            select: {
              id: true,
              openingAmount: true,
              closingAmount: true,
              openedAt: true,
              closedAt: true,
            },
            orderBy: {
              openedAt: "desc",
            },
          }),
          prisma.order.aggregate({
            where: {
              waiterId: selectedWaiterId,
              createdAt: {
                gte: businessDayStart,
                lt: businessDayEnd,
              },
            },
            _sum: {
              total: true,
            },
            _count: {
              id: true,
            },
          }),
        ])
      : null,
  ]);

  const shiftSummary = reportData
    ? buildWaiterShiftSummary(
        reportData[0],
        Number(reportData[1]._sum.total ?? 0),
      )
    : null;
  const waiterOrders = reportData ? Number(reportData[1]._count.id ?? 0) : 0;
  const totalSales = Number(dailyAggregate._sum.total ?? 0);
  const totalOrders = Number(dailyAggregate._count.id ?? 0);
  const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

  return (
    <AdminPage
      title="Reports"
      description="View business reports and analytics"
    >
      <form className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70 md:flex-row md:items-end">
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-sm font-bold text-slate-700">
            Staff
          </span>
          <NativeSelect
            name="waiterId"
            defaultValue={selectedWaiterId}
            className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
          >
            {waiters.length === 0 ? (
              <option value="">No waiters found</option>
            ) : (
              waiters.map((waiter) => (
                <option key={waiter.id} value={waiter.id}>
                  {waiter.fullName}
                </option>
              ))
            )}
          </NativeSelect>
        </label>
        <label htmlFor="report-business-date">
          <span className="mb-1 block text-sm font-bold text-slate-700">
            Business Day
          </span>
          <Input
            id="report-business-date"
            type="date"
            name="date"
            defaultValue={selectedDate}
            className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
          />
        </label>
        <Button type="submit">
          <Search data-icon="inline-start" />
          View Report
        </Button>
      </form>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total Sales"
          value={formatMoney(totalSales)}
          helper={businessDayLabel}
        />
        <MetricCard label="Total Orders" value={totalOrders} />
        <MetricCard
          label="Average Order Value"
          value={formatMoney(averageOrderValue)}
        />
        <MetricCard
          label="Waiter Orders"
          value={waiterOrders}
          helper={selectedWaiter?.fullName ?? "--"}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.8fr)]">
        <Card className="p-5">
          <h2 className="text-lg font-black text-slate-950">Sales Overview</h2>
          <MiniLineChart value={totalSales} />
        </Card>

        <Card className="p-5">
          <h2 className="text-lg font-black text-slate-950">
            Sales by Category
          </h2>
          <div className="mt-4 space-y-3">
            {categoryRows.map((category, index) => (
              <div
                key={category.id}
                className="flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`size-3 rounded-full ${
                      [
                        "bg-blue-500",
                        "bg-emerald-500",
                        "bg-orange-500",
                        "bg-red-400",
                        "bg-slate-400",
                      ][index]
                    }`}
                  />
                  <span className="text-sm font-bold text-slate-700">
                    {category.name}
                  </span>
                </div>
                <span className="text-sm font-black text-slate-950">
                  {category._count.products} items
                </span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <Card className="p-5">
        <h2 className="text-lg font-black text-slate-950">
          Waiter Balance Summary
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-500">Status</p>
            <div className="mt-2">
              <ToneBadge
                tone={shiftSummary?.status === "closed" ? "green" : "amber"}
              >
                {shiftSummary?.status ?? "No Shift"}
              </ToneBadge>
            </div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-500">Opening Balance</p>
            <p className="mt-2 text-xl font-black text-slate-950">
              {formatMoney(shiftSummary?.openingAmount)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-500">Expected Closing</p>
            <p className="mt-2 text-xl font-black text-slate-950">
              {formatMoney(shiftSummary?.expectedClosingAmount)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-500">Difference</p>
            <p className="mt-2 text-xl font-black text-slate-950">
              {formatMoney(shiftSummary?.variance)}
            </p>
          </div>
        </div>
      </Card>
    </AdminPage>
  );
}
