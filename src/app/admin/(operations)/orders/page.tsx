import Link from "next/link";
import { ChevronDown } from "lucide-react";
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
import { groupOrderCards, type OrderCardRound } from "@/lib/admin/order-cards";

type AdminOrdersPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    date?: string;
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
  customer: { select: { fullName: true } },
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
    <dl className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 text-sm">
      {roles.map(({ label, names }) => {
        const assigned = [...new Set(names.filter((name): name is string => Boolean(name)))];
        return assigned.length ? (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 break-words font-medium">{assigned.join(", ")}</dd>
          </div>
        ) : null;
      })}
    </dl>
  );
}

export default async function AdminOrdersPage({
  searchParams,
}: AdminOrdersPageProps) {
  const params = await searchParams;
  const q = params?.q?.trim() ?? "";
  const status = normalizeFilterChoice(
    params?.status,
    ORDER_STATUS_FILTERS,
    "all",
  );
  const date = normalizeFilterChoice(params?.date, ORDER_DATE_FILTERS, "today");
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startDate = date === "today" ? startOfToday : undefined;
  const searchNumber = Number(q);
  const hasOrderNumber = Boolean(q) && Number.isSafeInteger(searchNumber) && searchNumber > 0;
  const where = {
    ...(status !== "all"
      ? { status: status as "OPEN" | "PAID" | "CANCELLED" }
      : {}),
    ...(startDate
      ? {
          createdAt: {
            gte: startDate,
          },
        }
      : {}),
    ...(hasOrderNumber
      ? {
          OR: [
            { orderNumber: searchNumber },
            { tableCheck: { checkNumber: searchNumber } },
          ],
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
  const checkIds = [...new Set(
    recentOrders.map((order) => order.tableCheckId).filter((id): id is string => Boolean(id)),
  )];
  const standaloneIds = recentOrders
    .filter((order) => !order.tableCheckId)
    .map((order) => order.id);
  const allCardOrders = checkIds.length
    ? await prisma.order.findMany({
        where: {
          OR: [
            { tableCheckId: { in: checkIds } },
            { id: { in: standaloneIds } },
          ],
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
  const matchingKeys = recentOrders.map(
    (order) => order.tableCheckId ?? `order:${order.id}`,
  );
  const orderCards = groupOrderCards(cardRounds).sort(
    (a, b) => matchingKeys.indexOf(a.key) - matchingKeys.indexOf(b.key),
  );

  const openToday = ordersToday.filter(
    (order) => order.status === "OPEN",
  ).length;
  const paidToday = ordersToday.filter(
    (order) => order.status === "PAID",
  ).length;
  const revenueToday = ordersToday.reduce(
    (sum, order) => sum + Number(order.total),
    0,
  );

  return (
    <AdminPage title="Orders" description="Track and manage customer orders">
      <dl className="grid grid-cols-3 gap-2 rounded-2xl border bg-card p-4 text-sm md:hidden">
        <div><dt className="text-xs text-muted-foreground">Today</dt><dd className="mt-1 text-lg font-semibold">{ordersToday.length}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Open / Paid</dt><dd className="mt-1 text-lg font-semibold">{openToday} / {paidToday}</dd></div>
        <div className="min-w-0"><dt className="text-xs text-muted-foreground">Revenue</dt><dd className="mt-1 break-words text-lg font-semibold">{formatMoney(revenueToday)}</dd></div>
      </dl>
      <section className="hidden gap-4 sm:grid-cols-3 md:grid">
        <MetricCard label="Orders Today" value={ordersToday.length} />
        <MetricCard
          label="Open vs Paid"
          value={`${openToday} / ${paidToday}`}
        />
        <MetricCard label="Revenue Today" value={formatMoney(revenueToday)} />
      </section>

      <DataTableCard
        footer={
          <p className="text-sm font-medium text-slate-500">
            <span className="md:hidden">
              {orderCards.length} {orderCards.length === 1 ? "order" : "orders"} from {recentOrders.length} matching tickets. All rounds included.
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

        <section aria-label="Orders" className="space-y-4 bg-muted/30 p-4 md:hidden">
          <h2 className="text-base font-semibold">Recent orders</h2>
          {orderCards.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No orders found.</p>
          ) : (
            orderCards.map((card) => (
              <Card key={card.key} className="gap-5 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Order</p>
                    <h3 className="mt-1 break-words text-2xl font-semibold tracking-tight">
                      #{card.orderNumber}
                    </h3>
                  </div>
                  <ToneBadge tone={getStatusTone(card.status)}>
                    {getStatusLabel(card.status)}
                  </ToneBadge>
                </div>
                <div className="min-w-0">
                  {card.latest.tableName ? (
                    <p className="break-words text-lg font-semibold">{card.latest.tableName}</p>
                  ) : null}
                  <p className="mt-1 text-sm text-muted-foreground">
                    {getTypeLabel(card.latest.type)}
                    {card.latest.tableCheckId ? ` · ${card.rounds.length} ${card.rounds.length === 1 ? "round" : "rounds"}` : ""}
                  </p>
                </div>
                <OrderPeople rounds={card.rounds} />
                <div>
                  <p className="text-xs text-muted-foreground">
                    {card.latest.tableCheckId ? "Check total" : "Total"}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight">{formatMoney(card.total)}</p>
                </div>
                {card.latest.tableCheckId ? (
                  <details className="group border-t pt-2">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-md text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                      <span>View {card.rounds.length} {card.rounds.length === 1 ? "round" : "rounds"}</span>
                      <ChevronDown aria-hidden="true" className="size-5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                    </summary>
                    <ol aria-label={`Rounds for order #${card.orderNumber}`} className="mt-2 space-y-3">
                      {card.rounds.map((round) => (
                        <li key={round.id} className="space-y-3 rounded-xl border bg-muted/30 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="font-semibold">Round {round.tableCheckRound ?? 1}</h4>
                            <ToneBadge tone={getStatusTone(round.status)}>{getStatusLabel(round.status)}</ToneBadge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Ticket #{round.orderNumber} · {formatDateTime(round.createdAt)} · {round.itemCount} {round.itemCount === 1 ? "item" : "items"}
                          </p>
                          <OrderPeople rounds={[round]} />
                          <p className="font-semibold">{formatMoney(round.total)}</p>
                          <Button asChild variant="outline" className="min-h-11 w-full">
                            <Link href={`/admin/orders/${round.id}`}>Review round {round.tableCheckRound ?? 1}</Link>
                          </Button>
                        </li>
                      ))}
                    </ol>
                  </details>
                ) : (
                  <Button asChild variant="outline" className="min-h-11 w-full">
                    <Link href={`/admin/orders/${card.latest.id}`}>Review order</Link>
                  </Button>
                )}
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
                  <tr key={order.id} className="border-b border-slate-50">
                    <TableCell className="font-bold text-slate-400">
                      {index + 1}
                    </TableCell>
                    <TableCell className="font-black text-slate-950">
                      #{order.orderNumber}
                    </TableCell>
                    <TableCell>
                      {order.waiter?.fullName ??
                        order.cashier?.fullName ??
                        "Walk-in"}
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
