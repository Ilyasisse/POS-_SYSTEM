import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canViewOrderReceipt } from "@/lib/orders/receipt-access";
import { prisma } from "@/lib/prisma";
import PrintButton from "./PrintButton";

const money = (value: unknown) => `$${Number(value ?? 0).toFixed(2)}`;
const dateTime = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Nairobi",
});

export default async function PrintableOrderReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/staff-login");
  const { id } = await params;
  const [order, settings] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      include: {
        table: { select: { name: true } },
        tableCheck: { select: { checkNumber: true } },
        customer: { select: { fullName: true, email: true, phoneNumber: true } },
        waiter: { select: { fullName: true } },
        cashier: { select: { fullName: true } },
        orderItems: {
          orderBy: { createdAt: "asc" },
          include: { modifiers: { orderBy: { modifierName: "asc" } } },
        },
        payments: { orderBy: { createdAt: "asc" } },
        salesAdjustments: { orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.cafeSetting.findUnique({ where: { id: "default" } }),
  ]);
  if (!order) notFound();
  if (!canViewOrderReceipt(currentUser, order)) {
    redirect("/staff-login?error=unauthorized");
  }

  const subtotal = order.orderItems.reduce(
    (sum, item) => sum + Number(item.lineTotal),
    0,
  );
  const reductions = order.salesAdjustments.filter((adjustment) =>
    ["DISCOUNT", "COMPLIMENTARY", "STAFF_MEAL"].includes(adjustment.type),
  );
  const refunds = order.salesAdjustments.filter(
    (adjustment) => adjustment.type === "REFUND",
  );
  const paid = order.payments.reduce(
    (sum, payment) => sum + Number(payment.amountPaid),
    0,
  );
  const refunded = refunds.reduce(
    (sum, adjustment) => sum + Number(adjustment.amount),
    0,
  );
  const businessName = settings?.businessName || "Mash Allah Cafe";

  return (
    <main className="min-h-dvh bg-muted/30 p-4 text-foreground print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-sm justify-end print:hidden">
        <PrintButton />
      </div>
      <article className="relative mx-auto max-w-sm overflow-hidden rounded-2xl border bg-background p-6 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        {order.status !== "PAID" ? (
          <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
            <span className="-rotate-12 text-5xl font-black text-destructive/10">
              {order.status === "CANCELLED" ? "CANCELLED" : "UNPAID"}
            </span>
          </div>
        ) : null}
        <header className="relative border-b border-dashed pb-5 text-center">
          <Image
            src="/newer_logo.png"
            alt={businessName}
            width={64}
            height={64}
            className="mx-auto size-14 object-contain"
            priority
          />
          <h1 className="mt-2 text-xl font-bold">{businessName}</h1>
          <p className="text-sm text-muted-foreground">Customer receipt</p>
        </header>

        <dl className="relative grid grid-cols-2 gap-x-4 gap-y-2 border-b border-dashed py-4 text-xs">
          <div><dt className="text-muted-foreground">Order</dt><dd className="font-semibold">#{order.orderNumber}</dd></div>
          <div className="text-right"><dt className="text-muted-foreground">Date</dt><dd className="font-semibold">{dateTime.format(order.closedAt ?? order.createdAt)}</dd></div>
          <div><dt className="text-muted-foreground">Type</dt><dd>{order.type.replace("_", " ")}</dd></div>
          <div className="text-right"><dt className="text-muted-foreground">Table / check</dt><dd>{order.table?.name ?? "Counter"}{order.tableCheck ? ` · #${order.tableCheck.checkNumber}` : ""}</dd></div>
          <div><dt className="text-muted-foreground">Served by</dt><dd>{order.waiter?.fullName ?? order.cashier?.fullName ?? "Cafe staff"}</dd></div>
          <div className="text-right"><dt className="text-muted-foreground">Customer</dt><dd>{order.customer?.fullName ?? "Walk-in"}</dd></div>
        </dl>

        <section className="relative border-b border-dashed py-4">
          <h2 className="sr-only">Items</h2>
          <div className="space-y-3 text-sm">
            {order.orderItems.map((item) => (
              <div key={item.id}>
                <div className="grid grid-cols-[auto_1fr_auto] gap-2">
                  <span>{item.qty}×</span>
                  <span className="font-medium">{item.productName}</span>
                  <span>{money(item.lineTotal)}</span>
                </div>
                {item.modifiers.length ? (
                  <p className="ml-7 text-xs text-muted-foreground">
                    {item.modifiers.map((modifier) => `${modifier.qty}× ${modifier.modifierName}`).join(", ")}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="relative space-y-2 border-b border-dashed py-4 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          {reductions.map((adjustment) => (
            <div key={adjustment.id} className="flex justify-between text-muted-foreground">
              <span>{adjustment.type.replace("_", " ")}</span>
              <span>-{money(adjustment.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span>{money(order.total)}</span></div>
          <div className="flex justify-between"><span>Paid</span><span>{money(paid)}</span></div>
          {refunded ? <div className="flex justify-between text-destructive"><span>Refunded</span><span>-{money(refunded)}</span></div> : null}
        </section>

        {order.payments.length ? (
          <section className="relative border-b border-dashed py-4 text-xs">
            <h2 className="mb-2 font-semibold uppercase tracking-wide">Payments</h2>
            <div className="space-y-2">
              {order.payments.map((payment) => (
                <div key={payment.id} className="flex justify-between gap-4">
                  <span>{payment.method}{payment.reference ? ` · ${payment.reference}` : ""}</span>
                  <span>{money(payment.amountPaid)}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {order.notes ? <p className="relative border-b border-dashed py-4 text-xs"><strong>Order note:</strong> {order.notes}</p> : null}
        <footer className="relative pt-5 text-center text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Thank you for visiting!</p>
          <p>Receipt #{order.orderNumber}</p>
        </footer>
      </article>
    </main>
  );
}
