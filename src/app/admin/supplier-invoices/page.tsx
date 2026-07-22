import Link from "next/link";
import type { SupplierInvoiceStatus } from "@prisma/client";
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

const INVOICE_STATUSES = ["DRAFT", "FINALIZED", "VOID"] as const;
const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

function statusTone(status: SupplierInvoiceStatus) {
  if (status === "FINALIZED") return "green" as const;
  if (status === "VOID") return "red" as const;
  return "amber" as const;
}

export default async function SupplierInvoicesPage({
  searchParams,
}: {
  searchParams?: Promise<{ supplier?: string; status?: string }>;
}) {
  await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const query = (await searchParams) ?? {};
  const status = INVOICE_STATUSES.includes(
    query.status as SupplierInvoiceStatus,
  )
    ? (query.status as SupplierInvoiceStatus)
    : undefined;
  const [invoices, suppliers] = await Promise.all([
    prisma.supplierInvoice.findMany({
      where: { supplierId: query.supplier || undefined, status },
      include: {
        supplier: { select: { name: true } },
        purchaseOrder: { select: { orderNumber: true } },
        bill: { select: { status: true, totalAmount: true, paidAmount: true } },
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
  const drafts = invoices.filter((invoice) => invoice.status === "DRAFT");
  const finalized = invoices.filter(
    (invoice) => invoice.status === "FINALIZED",
  );
  const finalizedTotal = finalized.reduce(
    (sum, invoice) => sum + Number(invoice.totalAmount),
    0,
  );

  return (
    <AdminPage
      title="Supplier invoices"
      description="Review purchase-order invoice drafts, finalize money owed, and inspect read-only invoice history."
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
          {INVOICE_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline">
          Apply filters
        </Button>
      </form>

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Draft invoices" value={drafts.length} />
        <MetricCard label="Finalized invoices" value={finalized.length} />
        <MetricCard
          label="Finalized value"
          value={formatMoney(finalizedTotal)}
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
            {invoices.length ? (
              invoices.map((invoice) => (
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
                      Due {DATE_FORMATTER.format(invoice.dueDate)}
                    </div>
                  </TableCell>
                  <TableCell>{invoice._count.items}</TableCell>
                  <TableCell className="font-semibold tabular-nums">
                    {formatMoney(Number(invoice.totalAmount))}
                    {invoice.bill ? (
                      <div className="text-xs text-muted-foreground">
                        {invoice.bill.status} ·{" "}
                        {formatMoney(
                          Number(invoice.bill.totalAmount) -
                            Number(invoice.bill.paidAmount),
                        )}{" "}
                        remaining
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <ToneBadge tone={statusTone(invoice.status)}>
                      {invoice.status}
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
