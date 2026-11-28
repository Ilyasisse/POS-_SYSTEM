import Link from "next/link";
import AutoSubmitSelect from "@/components/AutoSubmitSelect";
import {
  AdminPage,
  Button,
  Card,
  SearchToolbar,
  MetricCard,
  Table,
  DataTableCard,
  TableCell,
  TableHead,
  ToneBadge,
} from "@/components/admin/shared";
import { prisma } from "@/lib/prisma";
import { normalizeFilterChoice } from "@/lib/admin/admin-filters";
import { ToastOnMount } from "@/components/ui/toast";
import { emailReceiptFromAdmin } from "./actions";
import { groupOrderCards, type OrderCardRound } from "@/lib/admin/order-cards";
import { orderFont } from "@/lib/admin/order-typography";

type AdminOrdersPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    date?: string;
    receiptStatus?: string;
  }>;
};

const ORDER_STATUS_FILTERS = ["all", "OPEN", "PAID", "CANCELLED"] as const;
const ORDER_DATE_FILTERS = ["today", "all"] as const;

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatDateTime(date: Date) {
  return dateTimeFormatter.format(date);
}

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

function getStatusTone(status: string) {
  if (status === "PAID") return "green" as const;
  if (status === "OPEN") return "amber" as const;
  return "red" as const;
}

const orderContext = {
  table: { select: { name: true } },
  tableCheck: { select: { checkNumber: true } },
  cashier: { select: { fullName: true } },
  waiter: { select: { fullName: true } },
  customer: { select: { fullName: true, email: true } },
  _count: { select: { orderItems: true } },
} as const;

function getStatusLabel(status: string) {
  if (status === "PAID") return "Paid";
  if (status === "OPEN") return "Open";
  return "Cancelled";
}

function getTypeLabel(type: OrderCardRound["type"]) {
  if (type === "DINE_IN") return "Dine-in";
  if (type === "TAKEOUT") return "Takeout";
  return "Delivery";
}

function OrderPeople({ rounds }: { rounds: readonly OrderCardRound[] }) {
  const roles = [
    { label: "Cashier", names: rounds.map((round) => round.cashierName) },
    { label: "Waiter", names: rounds.map((round) => round.waiterName) },
    { label: "Customer", names: rounds.map((round) => round.customerName) },
  ];
  return (
    <dl className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-4 text-lg leading-relaxed">
      {roles.map(({ label, names }) => {
        const assigned = [...new Set(names.filter((name): name is string => Boolean(name)))];
        return assigned.length ? (
          <div key={label} className="min-w-0">
            <dt className="text-muted-foreground text-base">{label}</dt>
            <dd className="mt-1 font-medium break-words">{assigned.join(", ")}</dd>
          </div>
        ) : null;
      })}
    </dl>
  );
}

export default async function AdminOrdersPage({ searchParams }: AdminOrdersPageProps) {
  const params = await searchParams;
  const q = params?.q?.trim() ?? "";
  const status = normalizeFilterChoice(params?.status, ORDER_STATUS_FILTERS, "all");
  const date = normalizeFilterChoice(params?.date, ORDER_DATE_FILTERS, "today");
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startDate = date === "today" ? startOfToday : undefined;
  const searchNumber = Number(q);
  const hasOrderNumber = Boolean(q) && Number.isSafeInteger(searchNumber) && searchNumber > 0;
  const where = {
    ...(status !== "all" ? { status: status as "OPEN" | "PAID" | "CANCELLED" } : {}),
    ...(startDate
      ? {
          createdAt: {
            gte: startDate,
          },
        }
      : {}),
    ...(hasOrderNumber
      ? {
          OR: [{ orderNumber: searchNumber }, { tableCheck: { checkNumber: searchNumber } }],
        }
      : {}),
  };

  const [recentOrders, ordersToday] = await Promise.all([
    prisma.order.findMany({
      where,
      take: 20,
      orderBy: {
        createdAt: "desc",
      },
      include: orderContext,
    }),
    prisma.order.findMany({
      where: {
        createdAt: {
          gte: startOfToday,
        },
      },
      select: {
        status: true,
        total: true,
      },
    }),
  ]);

  // Filters select matching orders, then load their complete checks so older,
  // paid, or otherwise filtered-out rounds are not lost from a mobile card.
  const checkIds = [
    ...new Set(
      recentOrders.map((order) => order.tableCheckId).filter((id): id is string => Boolean(id)),
    ),
  ];
  const standaloneIds = recentOrders
    .filter((order) => !order.tableCheckId)
    .map((order) => order.id);
  const allCardOrders = checkIds.length
    ? await prisma.order.findMany({
        where: {
          OR: [{ tableCheckId: { in: checkIds } }, { id: { in: standaloneIds } }],
        },
        orderBy: { createdAt: "desc" },
        include: orderContext,
      })
    : recentOrders;
  const cardRounds: OrderCardRound[] = allCardOrders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    tableCheckId: order.tableCheckId,
    tableCheckRound: order.tableCheckRound,
    checkNumber: order.tableCheck?.checkNumber ?? null,
    tableName: order.table?.name ?? null,
    type: order.type,
    status: order.status,
    total: Number(order.total),
    createdAt: order.createdAt,
    cashierName: order.cashier?.fullName ?? null,
    waiterName: order.waiter?.fullName ?? null,
    customerName: order.customer?.fullName ?? null,
    itemCount: order._count.orderItems,
  }));
  const matchingKeys = recentOrders.map((order) => order.tableCheckId ?? `order:${order.id}`);
  const orderCards = groupOrderCards(cardRounds).sort(
    (a, b) => matchingKeys.indexOf(a.key) - matchingKeys.indexOf(b.key),
  );

  const openToday = ordersToday.filter((order) => order.status === "OPEN").length;
  const paidToday = ordersToday.filter((order) => order.status === "PAID").length;
  const revenueToday = ordersToday.reduce((sum, order) => sum + Number(order.total), 0);

  return (
    <AdminPage title="Orders" description="Track and manage customer orders">
      {params?.receiptStatus === "sent" ? (
        <ToastOnMount tone="success" description="Receipt email accepted for delivery." />
      ) : null}
      {params?.receiptStatus === "configuration_missing" ? (
        <ToastOnMount
          tone="error"
          description="Receipt email is not configured. Add RESEND_API_KEY and RECEIPT_EMAIL_FROM."
        />
      ) : null}
      {params?.receiptStatus === "invalid_email" ? (
        <ToastOnMount tone="error" description="Enter a valid receipt email address." />
      ) : null}
      {params?.receiptStatus === "failed" ? (
        <ToastOnMount
          tone="error"
          description="The receipt could not be emailed. The failed attempt was logged."
        />
      ) : null}
      <dl className="bg-card grid grid-cols-3 gap-2 rounded-2xl border p-4 text-sm md:hidden">
        <div>
          <dt className="text-muted-foreground text-xs">Today</dt>
          <dd className="mt-1 text-lg font-semibold">{ordersToday.length}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Open / Paid</dt>
          <dd className="mt-1 text-lg font-semibold">
            {openToday} / {paidToday}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground text-xs">Revenue</dt>
          <dd className="mt-1 text-lg font-semibold break-words">{formatMoney(revenueToday)}</dd>
        </div>
      </dl>
      <section className="hidden gap-4 sm:grid-cols-3 md:grid">
        <MetricCard label="Orders Today" value={ordersToday.length} />
        <MetricCard label="Open vs Paid" value={`${openToday} / ${paidToday}`} />
        <MetricCard label="Revenue Today" value={formatMoney(revenueToday)} />
      </section>

      <DataTableCard
        footer={
          <p className="text-muted-foreground text-sm font-medium">
            <span className="md:hidden">
              {orderCards.length} {orderCards.length === 1 ? "order" : "orders"} from{" "}
              {recentOrders.length} matching tickets. All rounds included.
            </span>
            <span className="hidden md:inline">Showing 1 to {recentOrders.length} orders</span>
          </p>
        }
      >
        <div className="max-md:[&_form]:grid max-md:[&_form]:grid-cols-2 max-md:[&_label]:col-span-2">
          <SearchToolbar
            placeholder="Search orders..."
            defaultValue={q}
            hasActiveFilters={Boolean(q || status !== "all" || date !== "today")}
            clearHref="/admin/orders"
          >
            <AutoSubmitSelect name="status" defaultValue={status}>
              <option value="all">Status All</option>
              <option value="OPEN">Preparing</option>
              <option value="PAID">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </AutoSubmitSelect>
            <AutoSubmitSelect name="date" defaultValue={date}>
              <option value="today">Date Today</option>
              <option value="all">All Time</option>
            </AutoSubmitSelect>
          </SearchToolbar>
        </div>

        <section
          aria-label="Orders"
          className={`${orderFont.className} bg-muted/30 space-y-4 p-4 md:hidden`}
        >
          <h2 className="text-xl font-semibold">Recent orders</h2>
          {orderCards.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">No orders found.</p>
          ) : (
            orderCards.map((card) => (
              <Card
                key={card.key}
                className="gap-6 rounded-2xl p-5 [&_[data-slot=badge]]:px-3 [&_[data-slot=badge]]:py-1.5 [&_[data-slot=badge]]:text-base"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-base">Order</p>
                    <h3 className="mt-1 text-3xl font-bold tracking-tight break-words">
                      #{card.orderNumber}
                    </h3>
                  </div>
                  <ToneBadge tone={getStatusTone(card.status)}>
                    {getStatusLabel(card.status)}
                  </ToneBadge>
                </div>
                <div className="min-w-0">
                  {card.latest.tableName ? (
                    <p className="text-2xl font-semibold break-words">{card.latest.tableName}</p>
                  ) : null}
                  <p className="text-muted-foreground mt-1 text-lg">
                    {getTypeLabel(card.latest.type)}
                    {card.latest.tableCheckId
                      ? ` · ${card.rounds.length} ${card.rounds.length === 1 ? "round" : "rounds"}`
                      : ""}
                  </p>
                </div>
                <OrderPeople rounds={card.rounds} />
                <div>
                  <p className="text-muted-foreground text-base">
                    {card.latest.tableCheckId ? "Check total" : "Total"}
                  </p>
                  <p className="mt-1 text-3xl font-bold tracking-tight">
                    {formatMoney(card.total)}
                  </p>
                </div>
                <Button
                  asChild
                  variant="outline"
                  className="border-primary/60 text-primary min-h-14 w-full rounded-xl text-lg font-semibold"
                >
                  <Link href={`/admin/orders/${card.latest.id}`}>Review order</Link>
                </Button>
              </Card>
            ))
          )}
        </section>
        <div className="hidden md:block">
          <Table>
            <thead>
              <tr>
                <TableHead>#</TableHead>
                <TableHead>Order No.</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Actions</TableHead>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <TableCell colSpan={9} className="py-10 text-center">
                    No orders found.
                  </TableCell>
                </tr>
              ) : (
                recentOrders.map((order, index) => (
                  <tr key={order.id} className="border-border border-b">
                    <TableCell className="text-muted-foreground font-bold">{index + 1}</TableCell>
                    <TableCell className="text-foreground font-black">
                      #{order.orderNumber}
                    </TableCell>
                    <TableCell>
                      {order.waiter?.fullName ?? order.cashier?.fullName ?? "Walk-in"}
                    </TableCell>
                    <TableCell>{order.type.replace("_", "-")}</TableCell>
                    <TableCell>{formatMoney(Number(order.total))}</TableCell>
                    <TableCell>
                      <ToneBadge tone={getStatusTone(order.status)}>
                        {order.status === "PAID"
                          ? "Completed"
                          : order.status === "OPEN"
                            ? "Preparing"
                            : "Cancelled"}
                      </ToneBadge>
                    </TableCell>
                    <TableCell>{formatDateTime(order.createdAt)}</TableCell>
                    <TableCell>{order._count.orderItems}</TableCell>
                    <TableCell>
                      {order.status === "PAID" ? (
                        <form action={emailReceiptFromAdmin} className="flex min-w-64 gap-2">
                          <input type="hidden" name="orderId" value={order.id} />
                          <input
                            aria-label={`Receipt email for order ${order.orderNumber}`}
                            name="recipient"
                            type="email"
                            required
                            maxLength={254}
                            defaultValue={order.customer?.email ?? ""}
                            placeholder="customer@example.com"
                            className="h-9 min-w-0 flex-1 rounded-md border border-slate-200 px-2 text-sm"
                          />
                          <button
                            type="submit"
                            className="h-9 rounded-md bg-slate-900 px-3 text-xs font-bold text-white hover:bg-slate-700"
                          >
                            Send
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs text-slate-400">Available after payment</span>
                      )}
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/orders/${order.id}`}>Review</Link>
                      </Button>
                    </TableCell>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </DataTableCard>
    </AdminPage>
  );
}
