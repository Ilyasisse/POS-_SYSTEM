import Image from "next/image";
import { notFound } from "next/navigation";
import { Table, TableCell, TableHead } from "@/components/ui/table";
import { formatMoney } from "@/lib/admin/helper/formatMoney";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { getSupplierInvoiceDisplayStatus, SUPPLIER_INVOICE_DISPLAY_STATUS_LABELS } from "@/lib/suppliers/invoice-status";
import PrintButton from "./PrintButton";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "long",
  day: "numeric",
  year: "numeric",
});

export default async function PrintableSupplierInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const { id } = await params;
  const invoice = await prisma.supplierInvoice.findUnique({
    where: { id },
    include: {
      supplier: true,
      purchaseOrder: { select: { orderNumber: true } },
      createdBy: { select: { fullName: true } },
      finalizedBy: { select: { fullName: true } },
      bill: { select: { status: true, dueDate: true, totalAmount: true, paidAmount: true } },
      items: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!invoice) notFound();
  const displayStatus = getSupplierInvoiceDisplayStatus(invoice);
  const effectiveDueDate = invoice.bill?.dueDate ?? invoice.dueDate;
  const remainingBalance = invoice.bill ? Number(invoice.bill.totalAmount) - Number(invoice.bill.paidAmount) : null;

  return (
    <main className="min-h-dvh bg-muted/30 p-4 text-foreground print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-4xl justify-end print:hidden">
        <PrintButton />
      </div>
      <article className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl border bg-background p-6 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        {invoice.status === "DRAFT" ? (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            aria-hidden="true"
          >
            <span className="rotate-[-24deg] text-8xl font-black tracking-[0.2em] text-amber-500/10">
              DRAFT
            </span>
          </div>
        ) : null}
        <header className="relative flex items-start justify-between gap-6 border-b pb-6">
          <div className="flex items-center gap-4">
            <Image
              src="/newer_logo.png"
              alt="Mash Allah Cafe"
              width={72}
              height={72}
              className="size-16 object-contain"
              priority
            />
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Mash Allah Cafe
              </p>
              <h1 className="text-3xl font-semibold">Supplier invoice</h1>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold">
              {invoice.invoiceNumber || "No invoice number"}
            </div>
            <div
              className={`text-sm font-bold ${displayStatus === "DRAFT" ? "text-amber-700" : "text-muted-foreground"}`}
            >
              {SUPPLIER_INVOICE_DISPLAY_STATUS_LABELS[displayStatus]}
            </div>
          </div>
        </header>

        <section className="relative grid gap-6 border-b py-6 sm:grid-cols-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Supplier
            </h2>
            <p className="mt-1 text-xl font-semibold">
              {invoice.supplier.name}
            </p>
            <p className="text-sm">{invoice.supplier.contactName || ""}</p>
            <p className="text-sm">
              {invoice.supplier.phone || invoice.supplier.email || ""}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Invoice date</dt>
              <dd className="font-medium">
                {DATE_FORMATTER.format(invoice.invoiceDate)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Due date</dt>
              <dd className="font-medium">
                {DATE_FORMATTER.format(effectiveDueDate)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Purchase order</dt>
              <dd className="font-medium">
                {invoice.purchaseOrder
                  ? `PO #${invoice.purchaseOrder.orderNumber}`
                  : invoice.source === "MANUAL"
                    ? "Manual invoice"
                    : "Legacy invoice"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Prepared by</dt>
              <dd className="font-medium">
                {invoice.finalizedBy?.fullName ||
                  invoice.createdBy?.fullName ||
                  "Legacy import"}
              </dd>
            </div>
          </dl>
        </section>

        <Table className="relative my-6">
          <thead>
            <tr>
              <TableHead>Item</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Unit price</TableHead>
              <TableHead>Line total</TableHead>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} className="border-t">
                <TableCell className="font-medium">
                  {item.itemName}
                  {item.notes ? (
                    <div className="text-xs text-muted-foreground">
                      {item.notes}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>{item.itemUnit}</TableCell>
                <TableCell>{item.quantity.toString()}</TableCell>
                <TableCell>{formatMoney(Number(item.unitPrice))}</TableCell>
                <TableCell className="font-semibold">
                  {formatMoney(Number(item.lineTotal))}
                </TableCell>
              </tr>
            ))}
          </tbody>
        </Table>

        <div className="relative flex justify-end border-t pt-5">
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Invoice total</div>
            <div className="text-3xl font-semibold">
              {formatMoney(Number(invoice.totalAmount))}
            </div>
            {invoice.bill ? <div className="text-sm text-muted-foreground">{displayStatus === "PAID" ? "Paid in full" : `${formatMoney(remainingBalance || 0)} remaining`}</div> : null}
          </div>
        </div>

        {invoice.notes ? (
          <section className="relative mt-6 rounded-xl border p-4">
            <h2 className="font-semibold">Invoice notes</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm">{invoice.notes}</p>
          </section>
        ) : null}
      </article>
    </main>
  );
}
