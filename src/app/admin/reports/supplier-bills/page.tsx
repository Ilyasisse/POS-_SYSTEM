import Link from "next/link";
import { AdminPage, Button, Card, MetricCard } from "@/components/admin/shared";
import AutoSubmitInput from "@/components/AutoSubmitInput";
import AutoSubmitSelect from "@/components/AutoSubmitSelect";
import { Input } from "@/components/ui/input";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { isDailyCashLocked } from "@/lib/daily-cash/business-date";
import { prisma } from "@/lib/prisma";
import { formatSupplierInvoiceNumber } from "@/lib/suppliers/invoice-number";
import { getSupplierPaymentReversalError } from "@/lib/suppliers/payment-reversal";
import { getSupplierBillDueCutoffDate } from "@/lib/suppliers/supplier-bills";
import { createSupplierReceiptUrl } from "@/lib/suppliers/storage";
import { formatBusinessDateKey } from "@/lib/waiter/waiter-balance-calculations";
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
  const currentUser = await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
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
          status: { in: ["UNPAID", "PARTIAL"] },
          dueDate: { lte: dueCutoff },
        }
      : {
          createdAt: { gte: from, lte: to },
        }),
  },
  select: {
    id: true,
    totalAmount: true,
    paidAmount: true,
    status: true,
    dueDate: true,
    settledAt: true,
    createdAt: true,
    supplier: {
      select: {
        id: true,
        name: true,
      },
    },
    invoice: {
      select: {
        id: true,
        submittedAt: true,
        invoiceNumber: true,
        supplierReference: true,
        status: true,
        receiptObjectPath: true,
        finalizedBy: {
          select: {
            fullName: true,
          },
        },
      },
    },
    settledBy: {
      select: {
        fullName: true,
      },
    },
    allocations: {
      select: {
        id: true,
        amount: true,
        installmentId: true,
        supplierPayment: {
          select: {
            id: true,
            amount: true,
            paymentMethod: true,
            paidAt: true,
            recordedBy: { select: { fullName: true } },
            dailyCashPayment: {
              select: {
                dailyCashDay: { select: { businessDate: true } },
              },
            },
          },
        },
      },
      orderBy: { allocatedAt: "desc" },
    },
    installments: {
      select: {
        id: true,
        amount: true,
        paidAmount: true,
        dueDate: true,
        status: true,
      },
      orderBy: [
        { dueDate: "asc" },
        { sequence: "asc" },
      ],
    },
  },
  orderBy: [
    { dueDate: "asc" },
    { createdAt: "desc" },
  ],
  take: 500,
}),
    prisma.supplier.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        bills: {
          where: { status: { in: ["UNPAID", "PARTIAL"] } },
          select: { totalAmount: true, paidAmount: true },
        },
        payments: {
          select: {
            amount: true,
            allocations: { select: { amount: true } },
          },
        },
      },
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
        invoiceNumber: formatSupplierInvoiceNumber(bill.invoice.invoiceNumber),
        supplierReference: bill.invoice.supplierReference,
        status: bill.invoice.status,
        supplierId: bill.supplier.id,
        supplierName: bill.supplier.name,
        finalizedByName: bill.invoice.finalizedBy?.fullName || null,
        receiptUrl: bill.invoice.receiptObjectPath
          ? await createSupplierReceiptUrl(bill.invoice.receiptObjectPath)
          : null,
      },
      bill: {
        ...bill,
        payments: [
          ...bill.allocations
            .reduce((grouped, allocation) => {
              const payment = allocation.supplierPayment;
              const existing = grouped.get(payment.id);
              if (existing) {
                existing.allocatedAmount += Number(allocation.amount);
                existing.legacyAllocationAfterSchedule ||=
                  !allocation.installmentId && bill.installments.length > 0;
                return grouped;
              }
              const dailyCashBusinessDate = payment.dailyCashPayment
                ? formatBusinessDateKey(
                    payment.dailyCashPayment.dailyCashDay.businessDate,
                  )
                : null;
              grouped.set(payment.id, {
                id: payment.id,
                allocatedAmount: Number(allocation.amount),
                totalPaymentAmount: Number(payment.amount),
                paymentMethod: payment.paymentMethod,
                paidAt: payment.paidAt,
                recordedBy: payment.recordedBy,
                legacyAllocationAfterSchedule:
                  !allocation.installmentId && bill.installments.length > 0,
                dailyCashBusinessDate,
                reversalError: getSupplierPaymentReversalError({
                  legacyAllocationAfterSchedule:
                    !allocation.installmentId && bill.installments.length > 0,
                  dailyCashLinked: Boolean(payment.dailyCashPayment),
                  dailyCashLocked: dailyCashBusinessDate
                    ? isDailyCashLocked(dailyCashBusinessDate, now)
                    : false,
                  canManageDailyCash: hasPermission(
                    currentUser,
                    PERMISSIONS.DAILY_CASH_MANAGE,
                  ),
                }),
              });
              return grouped;
            }, new Map<string, {
              id: string;
              allocatedAmount: number;
              totalPaymentAmount: number;
              paymentMethod: string | null;
              paidAt: Date;
              recordedBy: { fullName: string };
              legacyAllocationAfterSchedule: boolean;
              dailyCashBusinessDate: string | null;
              reversalError: string | null;
            }>())
            .values(),
        ],
      },
    })),
  );

  const unpaid = bills
    .filter((bill) => bill.status !== "PAID")
    .reduce(
      (sum, bill) => sum + Number(bill.totalAmount) - Number(bill.paidAmount),
      0,
    );
  const paid = bills.reduce((sum, bill) => sum + Number(bill.paidAmount), 0);
  const supplierCredit = suppliers.reduce(
    (sum, supplier) =>
      sum +
      supplier.payments.reduce(
        (paymentSum, payment) =>
          paymentSum +
          Number(payment.amount) -
          payment.allocations.reduce(
            (allocationSum, allocation) =>
              allocationSum + Number(allocation.amount),
            0,
          ),
        0,
      ),
    0,
  );
  const supplierCashPaid = suppliers.reduce(
    (sum, supplier) =>
      sum +
      supplier.payments.reduce(
        (paymentSum, payment) => paymentSum + Number(payment.amount),
        0,
      ),
    0,
  );
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
  const supplierAccounts = suppliers.map((supplier) => {
    const outstanding = supplier.bills.reduce(
      (sum, bill) => sum + Number(bill.totalAmount) - Number(bill.paidAmount),
      0,
    );
    const credit = supplier.payments.reduce(
      (sum, payment) =>
        sum +
        Number(payment.amount) -
        payment.allocations.reduce(
          (allocationSum, allocation) =>
            allocationSum + Number(allocation.amount),
          0,
        ),
      0,
    );
    return { id: supplier.id, name: supplier.name, outstanding, credit };
  });

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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Unpaid balance" value={money(unpaid)} />
        <MetricCard label="Applied to invoices" value={money(paid)} />
        <MetricCard label="Supplier credit" value={money(supplierCredit)} />
        <MetricCard label="All-time cash paid" value={money(supplierCashPaid)} />
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
          {supplierAccounts.map((supplier) => (
            <div
              key={supplier.id}
              className="rounded-xl bg-slate-50 px-3 py-2 text-sm"
            >
              <div className="flex justify-between gap-3 font-semibold">
                <span>{supplier.name}</span>
                <span>
                  {money(Math.max(0, supplier.outstanding - supplier.credit))}{" "}
                  net owed
                </span>
              </div>
              <div className="mt-1 flex justify-between gap-3 text-xs text-muted-foreground">
                <span>Outstanding {money(supplier.outstanding)}</span>
                <span>Credit {money(supplier.credit)}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <SupplierBillsTable rows={rows} now={now} />
    </AdminPage>
  );
}
