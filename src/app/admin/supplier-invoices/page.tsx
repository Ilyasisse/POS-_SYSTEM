import Link from "next/link";
import {
  AdminPage,
  Button,
  DataTableCard,
  MetricCard,
  NativeSelect,
  Table,
  TableCell,
  TableHead,
  ToneBadge,
} from "@/components/admin/shared";
import { formatMoney } from "@/lib/admin/helper/formatMoney";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import {
  getSupplierInvoiceDisplayStatus,
  getSupplierInvoiceDisplayStatusWhere,
  SUPPLIER_INVOICE_DISPLAY_STATUS_LABELS,
  SUPPLIER_INVOICE_DISPLAY_STATUSES,
  SUPPLIER_INVOICE_DISPLAY_STATUS_TONES,
  type SupplierInvoiceDisplayStatus,
} from "@/lib/suppliers/invoice-status";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default async function SupplierInvoicesPage({
  searchParams,
}: {
  searchParams?: Promise<{ supplier?: string; status?: string }>;
}) {
  await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const query = (await searchParams) ?? {};
  const status = SUPPLIER_INVOICE_DISPLAY_STATUSES.includes(
    query.status as SupplierInvoiceDisplayStatus,
  )
    ? (query.status as SupplierInvoiceDisplayStatus)
    : undefined;
  const now = new Date();
  const [invoices, suppliers] = await Promise.all([
    prisma.supplierInvoice.findMany({
      where: {
        supplierId: query.supplier || undefined,
        ...(status ? getSupplierInvoiceDisplayStatusWhere(status, now) : {}),
      },
      include: {
        supplier: { select: { name: true } },
        purchaseOrder: { select: { orderNumber: true } },
        bill: {
          select: { status: true, totalAmount: true, paidAmount: true, dueDate: true },
        },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.supplier.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const invoiceRows = invoices.map((invoice) => ({
    ...invoice,
    displayStatus: getSupplierInvoiceDisplayStatus(invoice, now),
  }));
  const countStatus = (displayStatus: SupplierInvoiceDisplayStatus) =>
    invoiceRows.filter((invoice) => invoice.displayStatus === displayStatus)
      .length;
  const outstandingBalance = invoiceRows.reduce((sum, invoice) => {
    if (
      !invoice.bill ||
      !["PENDING", "PARTIALLY_PAID", "OVERDUE"].includes(
        invoice.displayStatus,
      )
    ) {
      return sum;
    }
    return (
      sum + Number(invoice.bill.totalAmount) - Number(invoice.bill.paidAmount)
    );
  }, 0);

  return (
    <AdminPage
      title="Supplier invoices"
      description="Review invoice drafts, approve supplier bills, and track payment status."
      action={
        <Button asChild variant="outline">
          <Link href="/admin/supplier-purchase-orders">Purchase orders</Link>
        </Button>
      }
    >
      <form className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_1fr_auto]">
        <NativeSelect
          name="supplier"
          defaultValue={query.supplier || ""}
          className="w-full"
        >
          <option value="">All suppliers</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          name="status"
          defaultValue={status || ""}
          className="w-full"
        >
          <option value="">All statuses</option>
          {SUPPLIER_INVOICE_DISPLAY_STATUSES.map((value) => (
            <option key={value} value={value}>
              {SUPPLIER_INVOICE_DISPLAY_STATUS_LABELS[value]}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline">
          Apply filters
        </Button>
      </form>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Draft invoices" value={countStatus("DRAFT")} />
        <MetricCard label="Pending invoices" value={countStatus("PENDING")} />
        <MetricCard
          label="Partially paid"
          value={countStatus("PARTIALLY_PAID")}
        />
        <MetricCard label="Overdue invoices" value={countStatus("OVERDUE")} />
        <MetricCard label="Paid invoices" value={countStatus("PAID")} />
        <MetricCard
          label="Outstanding balance"
          value={formatMoney(outstandingBalance)}
        />
      </section>

      <DataTableCard>
        <Table>
          <thead>
            <tr>
              <TableHead>Invoice</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Purchase order</TableHead>
              <TableHead>Invoice / due date</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
            </tr>
          </thead>
          <tbody>
            {invoiceRows.length ? (
              invoiceRows.map((invoice) => (
                <tr key={invoice.id} className="border-t">
                  <TableCell>
                    <Link
                      href={`/admin/supplier-invoices/${invoice.id}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      {invoice.invoiceNumber || "No invoice number"}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {invoice.source.replaceAll("_", " ")}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {invoice.supplier.name}
                  </TableCell>
                  <TableCell>
                    {invoice.purchaseOrder
                      ? `PO #${invoice.purchaseOrder.orderNumber}`
                      : "Legacy"}
                  </TableCell>
                  <TableCell>
                    <div>{DATE_FORMATTER.format(invoice.invoiceDate)}</div>
                    <div className="text-xs text-muted-foreground">
                      Due {DATE_FORMATTER.format(invoice.bill?.dueDate ?? invoice.dueDate)}
                    </div>
                  </TableCell>
                  <TableCell>{invoice._count.items}</TableCell>
                  <TableCell className="font-semibold tabular-nums">
                    {formatMoney(Number(invoice.totalAmount))}
                    {invoice.bill ? (
                      <div className="text-xs text-muted-foreground">
                        {invoice.displayStatus === "PAID"
                          ? "Paid in full"
                          : `${formatMoney(Number(invoice.bill.totalAmount) - Number(invoice.bill.paidAmount))} remaining`}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <ToneBadge
                      tone={SUPPLIER_INVOICE_DISPLAY_STATUS_TONES[invoice.displayStatus]}
                    >
                      {SUPPLIER_INVOICE_DISPLAY_STATUS_LABELS[invoice.displayStatus]}
                    </ToneBadge>
                  </TableCell>
                </tr>
              ))
            ) : (
              <tr>
                <TableCell colSpan={7}>
                  No supplier invoices match these filters.
                </TableCell>
              </tr>
            )}
          </tbody>
        </Table>
      </DataTableCard>
    </AdminPage>
  );
}
