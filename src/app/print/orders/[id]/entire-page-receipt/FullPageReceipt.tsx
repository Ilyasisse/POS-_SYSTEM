import Image from "next/image";
import type { ReceiptData } from "@/lib/orders/build-receipt-data";

export default function FullPageReceipt({ receipt }: { receipt: ReceiptData }) {
  return (
    <article className="relative mx-auto max-w-sm overflow-hidden rounded-2xl border bg-background p-6 shadow-sm print:max-w-none print:overflow-visible print:rounded-none print:border-0 print:p-0 print:shadow-none">
      {receipt.status !== "PAID" ? (
        <div
          className="absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <span className="-rotate-12 text-5xl font-black text-destructive/10">
            {receipt.status === "CANCELLED" ? "CANCELLED" : "UNPAID"}
          </span>
        </div>
      ) : null}
      <header className="relative border-b border-dashed pb-5 text-center">
        <Image
          src="/newer_logo.png"
          alt={receipt.businessName}
          width={64}
          height={64}
          className="mx-auto size-14 object-contain"
          priority
        />
        <h1 className="mt-2 text-xl font-bold">{receipt.businessName}</h1>
        <p className="text-sm text-muted-foreground">Customer receipt</p>
      </header>
      <dl className="relative grid grid-cols-2 gap-x-4 gap-y-2 border-b border-dashed py-4 text-xs">
        <div>
          <dt className="text-muted-foreground">Order</dt>
          <dd className="font-semibold">#{receipt.orderNumber}</dd>
        </div>
        <div className="text-right">
          <dt className="text-muted-foreground">Date</dt>
          <dd className="font-semibold">{receipt.dateTime}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Type</dt>
          <dd>{receipt.type}</dd>
        </div>
        <div className="text-right">
          <dt className="text-muted-foreground">Table/check</dt>
          <dd>{receipt.tableLabel}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Served by</dt>
          <dd>{receipt.servedBy}</dd>
        </div>
        <div className="text-right">
          <dt className="text-muted-foreground">Customer</dt>
          <dd>{receipt.customerName}</dd>
        </div>
      </dl>
      <section className="relative border-b border-dashed py-4">
        <h2 className="sr-only">Items</h2>
        <div className="space-y-3 text-sm">
          {receipt.items.map((item) => (
            <div key={item.position} className="break-inside-avoid">
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2">
                <span>{item.quantity}×</span>
                <span className="font-medium wrap-anywhere">{item.name}</span>
                <span>{item.lineTotal}</span>
              </div>
              {item.modifiers.length ? (
                <p className="ml-7 text-xs text-muted-foreground wrap-anywhere">
                  {item.modifiers.join(", ")}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </section>
      <section className="relative break-inside-avoid space-y-2 border-b border-dashed py-4 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{receipt.subtotal}</span>
        </div>
        {receipt.reductions.map((adjustment) => (
          <div
            key={adjustment.position}
            className="flex justify-between text-muted-foreground"
          >
            <span>{adjustment.label}</span>
            <span>{adjustment.amount}</span>
          </div>
        ))}
        <div className="flex justify-between border-t pt-2 text-base font-bold">
          <span>Total</span>
          <span>{receipt.total}</span>
        </div>
        <div className="flex justify-between">
          <span>Paid</span>
          <span>{receipt.paid}</span>
        </div>
        {receipt.refunded ? (
          <div className="flex justify-between text-destructive">
            <span>Refunded</span>
            <span>{receipt.refunded}</span>
          </div>
        ) : null}
      </section>
      {receipt.payments.length ? (
        <section className="relative border-b border-dashed py-4 text-xs">
          <h2 className="mb-2 font-semibold uppercase tracking-wide">
            Payments
          </h2>
          <div className="space-y-2">
            {receipt.payments.map((payment) => (
              <div
                key={payment.position}
                className="flex break-inside-avoid justify-between gap-4"
              >
                <span className="min-w-0 wrap-anywhere">
                  {payment.method}
                  {payment.reference ? ` · ${payment.reference}` : ""}
                </span>
                <span className="shrink-0">{payment.amount}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {receipt.notes ? (
        <p className="relative border-b border-dashed py-4 text-xs wrap-anywhere">
          <strong>Order note:</strong> {receipt.notes}
        </p>
      ) : null}
      <footer className="relative pt-5 text-center text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Thank you for visiting!</p>
        <p>Receipt #{receipt.orderNumber}</p>
      </footer>
    </article>
  );
}
