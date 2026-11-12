import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { getReportingWeekRange } from "@/lib/reports/reporting-calendar";
import { dashboardRange, outstandingBalance, paymentChart } from "@/lib/admin/dashboard-metrics";
import { resolveTableCheckIdentity } from "@/lib/cashier/table-checks";
import { summarizeSupplierBillsDue } from "@/lib/suppliers/supplier-bills";
import { formatMoney } from "@/lib/admin/helper/formatMoney";
import SalesChartCard from "@/components/admin/dashboard/UI Cards/SalesChartCard";
import DashboardRefresh from "@/components/admin/dashboard/DashboardRefresh";
import SupplierPaymentsDue from "@/components/admin/dashboard/SupplierPaymentsDue";

export const dynamic = "force-dynamic";
const actionClass =
  "inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring";

function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="border-border bg-card min-w-0 rounded-xl border p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requirePermission(PERMISSIONS.DASHBOARD_VIEW);
  const { period } = await searchParams;
  const now = new Date();
  const range = dashboardRange(period, now);
  const week = getReportingWeekRange(now);
  const isWeek = period === "week";
  const [
    paid,
    orderCount,
    openOrders,
    recentOrders,
    stock,
    schedules,
    checkouts,
    receipts,
    bills,
    payments,
  ] = await Promise.all([
    prisma.payment.aggregate({
      where: { createdAt: { gte: range.start, lt: range.end } },
      _sum: { amountPaid: true },
    }),
    prisma.order.count({ where: { createdAt: { gte: range.start, lt: range.end } } }),
    prisma.order.findMany({
      where: { status: "OPEN" },
      select: { total: true, payments: { select: { amountPaid: true } } },
    }),
    prisma.order.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        tableCheckRound: true,
        tableCheck: { select: { checkNumber: true } },
        type: true,
        status: true,
        total: true,
        table: { select: { name: true } },
        payments: { select: { amountPaid: true } },
      },
    }),
    prisma.inventorySupply.count({
      where: { isActive: true, inventoryAlertStatus: { in: ["LOW", "OUT"] } },
    }),
    prisma.supplierOrderSchedule.findMany({
      where: { deletedAt: null },
      select: {
        runs: { take: 1, orderBy: { createdAt: "desc" }, select: { status: true } },
      },
    }),
    prisma.customerCheckout.count({ where: { status: { in: ["REVIEW", "NEEDS_HELP"] } } }),
    prisma.mobileMoneyReceipt.count({
      where: {
        OR: [
          { status: "NEEDS_REVIEW" },
          { status: "AVAILABLE", direction: "INCOMING", assignedPaymentRequestId: null },
        ],
      },
    }),
    prisma.supplierBill.findMany({
      where: { status: { in: ["UNPAID", "PARTIAL"] } },
      select: {
        id: true,
        supplierId: true,
        dueDate: true,
        totalAmount: true,
        paidAmount: true,
        status: true,
        supplier: { select: { name: true } },
        installments: { select: { dueDate: true, amount: true, paidAmount: true, status: true } },
      },
    }),
    prisma.payment.findMany({
      where: { createdAt: { gte: week.start, lt: week.end } },
      select: { createdAt: true, amountPaid: true },
    }),
  ]);
  const supplier = summarizeSupplierBillsDue(
    bills.map((bill) => ({ ...bill, supplierName: bill.supplier.name })),
    now,
  );
  const failed = schedules.filter((schedule) => schedule.runs[0]?.status === "FAILED").length;
  const alerts = [
    {
      count: checkouts,
      title: "customer checkouts need review",
      help: "Includes customers requesting help",
      href: "/admin/payment-review",
    },
    {
      count: receipts,
      title: "payment receipts need review",
      help: "Awaiting verification",
      href: "/admin/payment-review",
    },
    {
      count: stock,
      title: "supplies low or out of stock",
      help: "Check stock levels",
      href: "/admin/inventory",
    },
    {
      count: failed,
      title: "supplier schedules have a failed latest run",
      help: "Inspect run history before retrying",
      href: "/admin/supplier-order-schedules",
    },
  ].filter((alert) => alert.count > 0);
  const metrics = [
    {
      label: isWeek ? "Paid sales this week" : "Paid sales today",
      value: formatMoney(paid._sum.amountPaid?.toNumber() ?? 0),
      help: "Recorded payments · before refunds",
      href: "/admin/reports",
    },
    {
      label: isWeek ? "Orders this week" : "Orders today",
      value: orderCount,
      help: "Created in selected business period",
      href: "/admin/orders?date=all",
    },
    {
      label: "Open orders",
      value: openOrders.length,
      help: "All dates · includes earlier orders",
      href: "/admin/orders?status=OPEN&date=all",
    },
    {
      label: "Unpaid balance",
      value: formatMoney(outstandingBalance(openOrders).toNumber()),
      help: "Remaining across all open orders",
      href: "/admin/orders?status=OPEN&date=all",
    },
  ];
  const date = new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeZone: "Africa/Nairobi",
  }).format(now);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeStyle: "short",
    timeZone: "Africa/Nairobi",
  }).format(now);
  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 pb-12 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Cafe overview</h1>
          <p className="text-muted-foreground mt-1 text-sm">{date} · EAT</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Updated {time} EAT · Business day 07:00–05:00
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <nav
            aria-label="Reporting period"
            className="border-border bg-card flex rounded-lg border p-1"
          >
            <Link
              prefetch={false}
              href="/admin"
              aria-current={!isWeek ? "page" : undefined}
              className={`${actionClass} ${!isWeek ? "bg-primary text-primary-foreground" : ""}`}
            >
              Today
            </Link>
            <Link
              prefetch={false}
              href="/admin?period=week"
              aria-current={isWeek ? "page" : undefined}
              className={`${actionClass} ${isWeek ? "bg-primary text-primary-foreground" : ""}`}
            >
              This week
            </Link>
          </nav>
          <DashboardRefresh />
        </div>
      </header>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Link
            prefetch={false}
            href={metric.href}
            key={metric.label}
            className="border-border bg-card hover:border-primary focus-visible:outline-ring min-w-0 rounded-xl border p-4 focus-visible:outline-2"
          >
            <p className="text-muted-foreground text-sm">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold break-words tabular-nums sm:text-3xl">
              {metric.value}
            </p>
            <p className="text-muted-foreground mt-2 text-xs">{metric.help}</p>
          </Link>
        ))}
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="order-2 lg:order-1">
          <Panel
            title="Recent orders"
            action={
              <Link href="/admin/orders?date=all" className={actionClass}>
                View orders <ArrowRight className="size-4" />
              </Link>
            }
          >
            <div className="divide-border divide-y">
              {recentOrders.length === 0 ? (
                <p className="text-muted-foreground py-5 text-sm">No orders yet.</p>
              ) : (
                recentOrders.map((order) => {
                  const identity = resolveTableCheckIdentity(order);
                  const remaining = outstandingBalance([order]);
                  const payment =
                    order.status === "CANCELLED"
                      ? "Cancelled"
                      : remaining.isZero()
                        ? "Paid"
                        : remaining.lt(order.total)
                          ? "Part paid"
                          : "Unpaid";
                  return (
                    <Link
                      prefetch={false}
                      key={order.id}
                      href={`/admin/orders/${order.id}`}
                      className="hover:bg-muted focus-visible:outline-ring flex min-h-20 flex-wrap items-center justify-between gap-2 py-3 focus-visible:outline-2"
                    >
                      <div>
                        <p className="font-semibold">
                          #{identity.orderNumber}{" "}
                          <span className="text-muted-foreground text-xs font-normal">
                            Round {identity.roundNumber} · Ticket #{identity.ticketNumber}
                          </span>
                        </p>
                        <p className="text-muted-foreground mt-1 text-sm">
                          {order.type.replaceAll("_", " ").toLowerCase()}
                          {order.table ? ` · ${order.table.name}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold tabular-nums">
                          {formatMoney(order.total.toNumber())}
                        </span>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${payment === "Paid" ? "bg-success/15" : "bg-warning/15"}`}
                        >
                          {payment}
                        </span>
                        <ArrowRight aria-hidden="true" className="size-4" />
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </Panel>
        </div>
        <div className="order-1 space-y-5 lg:order-2">
          <section id="needs-attention" className="scroll-mt-24">
            <Panel
              title={`Needs attention · ${alerts.reduce((total, alert) => total + alert.count, 0)}`}
            >
              <p className="text-muted-foreground mb-2 text-xs">
                All dates. Counts represent separate records, not unique incidents.
              </p>
              {alerts.length === 0 ? (
                <p className="py-4 text-sm">No outstanding alerts in these queues.</p>
              ) : (
                <div className="divide-border divide-y">
                  {alerts.map((alert) => (
                    <Link
                      prefetch={false}
                      href={alert.href}
                      key={alert.title}
                      className="hover:bg-muted focus-visible:outline-ring flex min-h-20 items-center gap-3 py-3 focus-visible:outline-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">
                          {alert.count} {alert.title}
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs">{alert.help}</p>
                      </div>
                      <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </Panel>
          </section>
          <Panel title="Supplier payments">
            <p className="text-muted-foreground text-sm">
              Due through tomorrow · Includes overdue bills
            </p>
            <p className="my-3 text-2xl font-semibold tabular-nums">
              {formatMoney(supplier.totalRemaining)}
            </p>
            <dl className="grid grid-cols-3 gap-2 text-xs">
              {[
                ["Overdue", supplier.overdueRemaining],
                ["Today", supplier.dueTodayRemaining],
                ["Tomorrow", supplier.dueTomorrowRemaining],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="mt-1 font-semibold tabular-nums">{formatMoney(Number(value))}</dd>
                </div>
              ))}
            </dl>
            <Link
              href="/admin/reports/supplier-bills?scope=due-through-tomorrow"
              className={actionClass}
            >
              Review {supplier.billCount} bills <ArrowRight className="size-4" />
            </Link>
            <details className="mt-2">
              <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">
                Supplier breakdown
              </summary>
              <SupplierPaymentsDue summary={supplier} />
            </details>
          </Panel>
        </div>
      </div>
      <div className="hidden sm:block">
        <Panel
          title="Sales overview"
          action={
            <Link href="/admin/reports" className={actionClass}>
              View reports <ArrowRight className="size-4" />
            </Link>
          }
        >
          <p className="text-muted-foreground mb-4 text-sm">
            Recorded payments · This reporting week · Before refunds
          </p>
          <SalesChartCard points={paymentChart(payments, now)} />
        </Panel>
      </div>
      <Link href="/admin/reports" className={`${actionClass} sm:hidden`}>
        View sales report <ArrowRight className="size-4" />
      </Link>
      <nav aria-label="Quick actions" className="flex flex-wrap gap-3">
        {[
          ["Edit menu", "/admin/products"],
          ["Receive stock", "/admin/inventory"],
          ["Manage staff", "/admin/staff"],
        ].map(([label, href]) => (
          <Link
            prefetch={false}
            className="border-border bg-card hover:bg-muted inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium"
            href={href}
            key={href}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
