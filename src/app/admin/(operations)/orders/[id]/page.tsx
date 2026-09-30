import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { notFound } from "next/navigation";
import {
  AdminPage,
  Button,
  Card,
  Table,
  TableCell,
  TableHead,
  ToneBadge,
} from "@/components/admin/shared";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { groupOrderCards } from "@/lib/admin/order-cards";
import { orderFont } from "@/lib/admin/order-typography";
import OrderAdjustmentForm from "./OrderAdjustmentForm";

function money(value: { toString(): string } | number) {
  return `$${Number(value).toFixed(2)}`;
}

function statusLabel(status: string) {
  return status === "OPEN" ? "Open" : status === "PAID" ? "Paid" : "Cancelled";
}

function statusTone(status: string) {
  return status === "OPEN" ? "amber" as const : status === "PAID" ? "green" as const : "red" as const;
}

function typeLabel(type: string) {
  return type === "DINE_IN" ? "Dine-in" : type === "TAKEOUT" ? "Takeout" : "Delivery";
}

const roundContext = {
  table: { select: { name: true } },
  tableCheck: { select: { checkNumber: true } },
  cashier: { select: { fullName: true } },
  waiter: { select: { fullName: true } },
  customer: { select: { fullName: true } },
  _count: { select: { orderItems: true } },
} as const;

export default async function AdminOrderDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, currentUser] = await Promise.all([
    params,
    requirePermission(PERMISSIONS.ADMIN_ACCESS),
  ]);
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      ...roundContext,
      orderItems: {
        orderBy: { createdAt: "asc" },
        include: { modifiers: true },
      },
      payments: { select: { amountPaid: true } },
      salesAdjustments: {
        orderBy: { createdAt: "desc" },
        include: {
          approvedBy: { select: { fullName: true } },
          orderItem: { select: { productName: true } },
        },
      },
    },
  });
  if (!order) notFound();

  const checkOrders = order.tableCheckId
    ? await prisma.order.findMany({
        where: { tableCheckId: order.tableCheckId },
        include: roundContext,
      })
    : [order];
  // Always include the selected ticket, even if it changes during the second read.
  const rounds = [order, ...checkOrders.filter((round) => round.id !== order.id)];
  const [check] = groupOrderCards(rounds.map((round) => ({
    id: round.id,
    orderNumber: round.orderNumber,
    tableCheckId: round.tableCheckId,
    tableCheckRound: round.tableCheckRound,
    checkNumber: round.tableCheck?.checkNumber ?? null,
    tableName: round.table?.name ?? null,
    type: round.type,
    status: round.status,
    total: Number(round.total),
    createdAt: round.createdAt,
    cashierName: round.cashier?.fullName ?? null,
    waiterName: round.waiter?.fullName ?? null,
    customerName: round.customer?.fullName ?? null,
    itemCount: round._count.orderItems,
  })));
  if (!check) notFound();
  const people = [
    { label: "Cashier", name: order.cashier?.fullName },
    { label: "Waiter", name: order.waiter?.fullName },
    { label: "Customer", name: order.customer?.fullName },
  ].filter((person) => person.name);

  const subtotal = order.orderItems.reduce(
    (sum, item) => sum + Number(item.lineTotal),
    0,
  );
  const paid = order.payments.reduce(
    (sum, payment) => sum + Number(payment.amountPaid),
    0,
  );

  return (
    <AdminPage
      title={`Order #${check.orderNumber}`}
      description={order.tableCheckId
        ? `Reviewing round ${order.tableCheckRound ?? 1} · Ticket #${order.orderNumber}`
        : "Review the order, payments, and approved adjustments."}
      action={<Button asChild variant="outline"><Link href="/admin/orders">Back to orders</Link></Button>}
    >
      <Card className={`${orderFont.className} gap-6 rounded-2xl p-5 md:hidden [&_[data-slot=badge]]:px-3 [&_[data-slot=badge]]:py-1.5 [&_[data-slot=badge]]:text-base`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base text-muted-foreground">Order</p>
            <h2 className="mt-1 break-words text-3xl font-bold tracking-tight">#{check.orderNumber}</h2>
          </div>
          <ToneBadge tone={statusTone(check.status)}>{statusLabel(check.status)}</ToneBadge>
        </div>
        <div className="min-w-0">
          {order.table?.name ? <p className="break-words text-2xl font-semibold">{order.table.name}</p> : null}
          <p className="mt-1 text-lg text-muted-foreground">
            {typeLabel(order.type)}
            {order.tableCheckId ? ` · ${check.rounds.length} ${check.rounds.length === 1 ? "round" : "rounds"}` : ""}
          </p>
        </div>
        {people.length ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-base">
            {people.map((person) => (
              <div key={person.label} className="min-w-0">
                <dt className="text-base text-muted-foreground">{person.label}</dt>
                <dd className="mt-1 break-words text-lg font-medium">{person.name}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {order.tableCheckId ? (
          <div>
            <p className="text-base text-muted-foreground">Check total</p>
            <p className="mt-1 text-3xl font-bold tracking-tight">{money(check.total)}</p>
          </div>
        ) : null}
        <div className="rounded-xl bg-muted/40 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-base font-semibold">
              {order.tableCheckId ? `Reviewing round ${order.tableCheckRound ?? 1}` : "This order"}
            </p>
            <ToneBadge tone={statusTone(order.status)}>{statusLabel(order.status)}</ToneBadge>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <dt className="text-base text-muted-foreground">{order.tableCheckId ? "Round total" : "Total"}</dt>
              <dd className="mt-1 break-words text-2xl font-semibold">{money(order.total)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-base text-muted-foreground">{order.tableCheckId ? "Paid this round" : "Paid"}</dt>
              <dd className="mt-1 break-words text-2xl font-semibold">{money(paid)}</dd>
            </div>
          </dl>
        </div>
        {order.tableCheckId ? (
          <details className="group border-t pt-2">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-md text-base font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              <span>View all {check.rounds.length} {check.rounds.length === 1 ? "round" : "rounds"}</span>
              <ChevronDown aria-hidden="true" className="size-5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
            </summary>
            <ol aria-label={`Rounds for order #${check.orderNumber}`} className="mt-2 space-y-3">
              {check.rounds.map((round) => (
                <li key={round.id} className="space-y-3 rounded-xl border bg-muted/30 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">Round {round.tableCheckRound ?? 1}</h3>
                    <ToneBadge tone={statusTone(round.status)}>{statusLabel(round.status)}</ToneBadge>
                  </div>
                  <p className="text-base text-muted-foreground">
                    Ticket #{round.orderNumber} · {round.createdAt.toLocaleString()} · {round.itemCount} {round.itemCount === 1 ? "item" : "items"}
                  </p>
                  <dl className="grid grid-cols-2 gap-3 text-base">
                    {[
                      { label: "Cashier", name: round.cashierName },
                      { label: "Waiter", name: round.waiterName },
                      { label: "Customer", name: round.customerName },
                    ].filter((person) => person.name).map((person) => (
                      <div key={person.label} className="min-w-0">
                        <dt className="text-base text-muted-foreground">{person.label}</dt>
                        <dd className="mt-1 break-words text-lg font-medium">{person.name}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="font-semibold">{money(round.total)}</p>
                  {round.id === order.id ? (
                    <p className="text-base font-medium text-muted-foreground">Currently viewing</p>
                  ) : (
                    <Button asChild variant="outline" className="min-h-14 w-full rounded-xl text-lg font-semibold">
                      <Link href={`/admin/orders/${round.id}`}>Review round {round.tableCheckRound ?? 1}</Link>
                    </Button>
                  )}
                </li>
              ))}
            </ol>
          </details>
        ) : null}
      </Card>

      <section className="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-4">
        <Card className="gap-1 p-5"><p className="text-sm text-muted-foreground">Status</p><ToneBadge tone={order.status === "PAID" ? "green" : order.status === "OPEN" ? "amber" : "red"}>{order.status}</ToneBadge></Card>
        <Card className="gap-1 p-5"><p className="text-sm text-muted-foreground">Current total</p><p className="text-2xl font-semibold">{money(order.total)}</p></Card>
        <Card className="gap-1 p-5"><p className="text-sm text-muted-foreground">Paid</p><p className="text-2xl font-semibold">{money(paid)}</p></Card>
        <Card className="gap-1 p-5"><p className="text-sm text-muted-foreground">Table / staff</p><p className="font-semibold">{order.table?.name ?? order.type.replace("_", "-")}</p><p className="text-xs text-muted-foreground">{order.waiter?.fullName ?? order.cashier?.fullName ?? "Walk-in"}</p></Card>
      </section>

      <Card className="overflow-hidden rounded-2xl p-0">
        <div className="border-b px-5 py-4"><h2 className="font-semibold">Order items</h2><p className="text-sm text-muted-foreground">Original subtotal: {money(subtotal)}</p></div>

        <ul aria-label="Order items" className={`${orderFont.className} space-y-3 bg-muted/30 p-4 md:hidden`}>
          {order.orderItems.length === 0 ? (
            <li className="py-6 text-center text-base text-muted-foreground">No items in this order.</li>
          ) : order.orderItems.map((item) => (
            <li key={item.id} className="space-y-3 rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="break-words text-lg font-semibold">{item.productName}</h3>
                  {item.modifiers.length ? (
                    <p className="mt-1 break-words text-base text-muted-foreground">
                      {item.modifiers.map((modifier) => modifier.modifierName).join(", ")}
                    </p>
                  ) : null}
                </div>
                <p className="shrink-0 text-lg font-semibold">{money(item.lineTotal)}</p>
              </div>
              <p className="text-base text-muted-foreground">
                Quantity {item.qty} · {money(item.unitPrice)} each
              </p>
            </li>
          ))}
        </ul>
        <div className="hidden md:block">
          <Table>
            <thead><tr><TableHead>Item</TableHead><TableHead>Quantity</TableHead><TableHead>Unit price</TableHead><TableHead>Total</TableHead></tr></thead>
            <tbody>
              {order.orderItems.map((item) => (
                <tr key={item.id} className="border-b">
                  <TableCell><p className="font-medium">{item.productName}</p>{item.modifiers.length ? <p className="text-xs text-muted-foreground">{item.modifiers.map((modifier) => modifier.modifierName).join(", ")}</p> : null}</TableCell>
                  <TableCell>{item.qty}</TableCell><TableCell>{money(item.unitPrice)}</TableCell><TableCell>{money(item.lineTotal)}</TableCell>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.75fr)]">
        <Card className="min-w-0 rounded-2xl p-5">
          <div><h2 className="font-semibold">Adjustment history</h2><p className="text-sm text-muted-foreground">Every action records its reason and approver.</p></div>
          {order.salesAdjustments.length ? (
            <div className="space-y-3 md:space-y-0 md:divide-y">
              {order.salesAdjustments.map((adjustment) => (
                <div key={adjustment.id} className="space-y-2 rounded-xl border bg-muted/30 p-4 text-sm md:space-y-1 md:rounded-none md:border-0 md:bg-transparent md:px-0 md:py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3"><ToneBadge tone={adjustment.type === "REFUND" || adjustment.type === "VOID" ? "red" : "blue"}>{adjustment.type.replace("_", " ")}</ToneBadge><strong>{money(adjustment.amount)}</strong></div>
                  <p className="break-words">{adjustment.reason}</p>
                  <p className="break-words text-xs text-muted-foreground">{adjustment.orderItem?.productName ? `${adjustment.orderItem.productName} · ` : ""}Approved by {adjustment.approvedBy.fullName} · {adjustment.createdAt.toLocaleString()}</p>
                </div>
              ))}
            </div>
          ) : <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">No adjustments recorded.</p>}
        </Card>

        <Card className="min-w-0 rounded-2xl p-5 max-md:[&_button[type=submit]]:h-auto max-md:[&_button[type=submit]]:min-h-11 max-md:[&_button[type=submit]]:w-full max-md:[&_button[type=submit]]:whitespace-normal">
          <div><h2 className="font-semibold">Record adjustment</h2><p className="text-sm text-muted-foreground">{order.tableCheckId ? `Applies only to round ${order.tableCheckRound ?? 1}, ticket #${order.orderNumber}. ` : ""}Sensitive actions require the correct manager permission.</p></div>
          <OrderAdjustmentForm
            key={order.id}
            orderId={order.id}
            orderStatus={order.status}
            orderTotal={order.total.toFixed(2)}
            lines={order.orderItems.map((item) => ({ id: item.id, label: `${item.qty}× ${item.productName} — ${money(item.lineTotal)}`, lineTotal: item.lineTotal.toFixed(2) }))}
            canApproveOperational={hasPermission(currentUser, PERMISSIONS.ADJUSTMENT_OPERATIONAL_APPROVE)}
            canApproveFinancial={hasPermission(currentUser, PERMISSIONS.ADJUSTMENT_FINANCIAL_APPROVE)}
          />
        </Card>
      </section>
    </AdminPage>
  );
}
