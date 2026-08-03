import Link from "next/link";
import { AdminPage, Button, Card, MetricCard } from "@/components/admin/shared";
import AutoSubmitInput from "@/components/AutoSubmitInput";
import AutoSubmitSelect from "@/components/AutoSubmitSelect";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";
import { getSupplierBillDueCutoffDate } from "@/lib/suppliers/supplier-bills";
import { createSupplierReceiptUrl } from "@/lib/suppliers/storage";
import SupplierBillsTable from "./SupplierBillsTable";

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

function dateInput(
  value: string | undefined,
  fallback: Date,
  endOfDay = false,
) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const parsed = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

const SUPPLIER_BILL_PAYMENT_STATUSES = ["UNPAID", "PARTIAL", "PAID"] as const;

type SupplierBillPaymentStatus =
  (typeof SUPPLIER_BILL_PAYMENT_STATUSES)[number];

function paymentStatus(value: string | undefined) {
  return SUPPLIER_BILL_PAYMENT_STATUSES.includes(
    value as SupplierBillPaymentStatus,
  )
    ? (value as SupplierBillPaymentStatus)
    : undefined;
}

export default async function SupplierBillsReportPage({
  searchParams,
}: {
  searchParams?: Promise<{
    from?: string;
    to?: string;
    supplier?: string;
    scope?: string;
    status?: string;
  }>;
}) {
  const params = (await searchParams) || {};
  const now = new Date();
  const showingDueThroughTomorrow = params.scope === "due-through-tomorrow";
  const dueCutoff = getSupplierBillDueCutoffDate(now);
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const from = dateInput(params.from, defaultFrom);
  const to = dateInput(params.to, now, true);
  const requestedPaymentStatus = paymentStatus(params.status);
  const selectedPaymentStatus =
    showingDueThroughTomorrow && requestedPaymentStatus === "PAID"
      ? undefined
      : requestedPaymentStatus;

  const [bills, suppliers, nonFinalInvoices] = await Promise.all([
    prisma.supplierBill.findMany({
      where: {
        supplierId: params.supplier || undefined,
        ...(showingDueThroughTomorrow
          ? {
              status: selectedPaymentStatus ?? { in: ["UNPAID", "PARTIAL"] },
              dueDate: { lte: dueCutoff },
            }
          : {
              status: selectedPaymentStatus,
              createdAt: { gte: from, lte: to },
            }),
      },
      include: {
        supplier: { select: { name: true } },
        invoice: {
          include: { finalizedBy: { select: { fullName: true } } },
        },
        settledBy: { select: { fullName: true } },
        payments: {
          include: { recordedBy: { select: { fullName: true } } },
          orderBy: { paidAt: "desc" },
        },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 500,
    }),
    prisma.supplier.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.supplierInvoice.findMany({
      where: {
        supplierId: params.supplier || undefined,
        submittedAt: showingDueThroughTomorrow
          ? undefined
          : { gte: from, lte: to },
        status: { in: ["DRAFT", "VOID"] },
      },
      select: { status: true, totalAmount: true },
      take: 500,
    }),
  ]);

  const rows = await Promise.all(
    bills.map(async (bill) => ({
      invoice: {
        id: bill.invoice.id,
        submittedAt: bill.invoice.submittedAt,
        invoiceNumber: bill.invoice.invoiceNumber,
        status: bill.invoice.status,
        supplierName: bill.supplier.name,
        finalizedByName: bill.invoice.finalizedBy?.fullName || null,
        receiptUrl: bill.invoice.receiptObjectPath
          ? await createSupplierReceiptUrl(bill.invoice.receiptObjectPath)
          : null,
      },
      bill,
    })),
  );

  const unpaid = bills
    .filter((bill) => bill.status !== "PAID")
    .reduce(
      (sum, bill) => sum + Number(bill.totalAmount) - Number(bill.paidAmount),
      0,
    );
  const paid = bills.reduce((sum, bill) => sum + Number(bill.paidAmount), 0);
  const draftValue = nonFinalInvoices
    .filter((invoice) => invoice.status === "DRAFT")
    .reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0);
  const voidCount = nonFinalInvoices.filter(
    (invoice) => invoice.status === "VOID",
  ).length;
  const dayStart = startOfDay(now);
  const weekStart = startOfDay(
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - ((now.getDay() + 6) % 7),
    ),
  );
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const totalSince = (date: Date) =>
    bills
      .filter((bill) => bill.createdAt >= date)
      .reduce((sum, bill) => sum + Number(bill.totalAmount), 0);
  const supplierTotals = new Map<string, number>();
  for (const bill of bills) {
    supplierTotals.set(
      bill.supplier.name,
      (supplierTotals.get(bill.supplier.name) || 0) + Number(bill.totalAmount),
    );
  }

  return (
    <AdminPage
      title="Supplier bills"
      description="Audit approved supplier invoices, balances, due dates, and every payment."
    >
      <form
        className={`grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 ${showingDueThroughTomorrow ? "sm:grid-cols-2" : "sm:grid-cols-4"}`}
      >
        {showingDueThroughTomorrow ? (
          <Input type="hidden" name="scope" value="due-through-tomorrow" />
        ) : null}
        <AutoSubmitSelect
          name="supplier"
          defaultValue={params.supplier || ""}
          aria-label="Supplier"
          className="h-10 w-full rounded-lg border border-slate-200 px-2"
        >
          <option value="">All suppliers</option>
          {suppliers.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </AutoSubmitSelect>
        <AutoSubmitSelect
          name="status"
          defaultValue={selectedPaymentStatus || ""}
          aria-label="Payment status"
          className="h-10 w-full rounded-lg border border-slate-200 px-2"
        >
          <option value="">
            {showingDueThroughTomorrow
              ? "All outstanding"
              : "All payment statuses"}
          </option>
          <option value="UNPAID">Unpaid</option>
          <option value="PARTIAL">Partially paid</option>
          {showingDueThroughTomorrow ? null : (
            <option value="PAID">Paid</option>
          )}
        </AutoSubmitSelect>
        {showingDueThroughTomorrow ? null : (
          <>
            <AutoSubmitInput
              type="date"
              name="from"
              defaultValue={from.toISOString().slice(0, 10)}
              aria-label="Start date"
            />
            <AutoSubmitInput
              type="date"
              name="to"
              defaultValue={to.toISOString().slice(0, 10)}
              aria-label="End date"
            />
          </>
        )}
      </form>

      {showingDueThroughTomorrow ? (
        <Card className="flex flex-col gap-3 border-amber-200 bg-amber-50 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold text-amber-900">
            Showing every unpaid or partially paid invoice bill due through
            tomorrow, regardless of invoice date.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/reports/supplier-bills">
              View date-range report
            </Link>
          </Button>
        </Card>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Unpaid balance" value={money(unpaid)} />
        <MetricCard label="Payments recorded" value={money(paid)} />
        <MetricCard label="Draft invoice value" value={money(draftValue)} />
        <MetricCard label="Void invoices" value={voidCount} />
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Today's bills" value={money(totalSince(dayStart))} />
        <MetricCard label="This week" value={money(totalSince(weekStart))} />
        <MetricCard label="This month" value={money(totalSince(monthStart))} />
      </section>
      <Card className="p-4">
        <h2 className="font-black">Supplier totals</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[...supplierTotals].map(([name, total]) => (
            <div
              key={name}
              className="flex justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm"
            >
              <span>{name}</span>
              <strong>{money(total)}</strong>
            </div>
          ))}
        </div>
      </Card>
      <SupplierBillsTable rows={rows} now={now} />
    </AdminPage>
  );
}
