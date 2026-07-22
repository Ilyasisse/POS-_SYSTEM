import Link from "next/link";
import { AdminPage, Button, Card, MetricCard } from "@/components/admin/shared";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
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

export default async function SupplierBillsReportPage({
  searchParams,
}: {
  searchParams?: Promise<{
    from?: string;
    to?: string;
    supplier?: string;
    scope?: string;
  }>;
}) {
  const params = (await searchParams) || {};
  const now = new Date();
  const showingDueThroughTomorrow = params.scope === "due-through-tomorrow";
  const dueCutoff = getSupplierBillDueCutoffDate(now);
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const from = dateInput(params.from, defaultFrom);
  const to = dateInput(params.to, now, true);

  const [bills, suppliers, legacyPending] = await Promise.all([
    prisma.supplierBill.findMany({
      where: {
        supplierId: params.supplier || undefined,
        ...(showingDueThroughTomorrow
          ? {
              status: { in: ["UNPAID", "PARTIAL"] },
              dueDate: { lte: dueCutoff },
            }
          : { createdAt: { gte: from, lte: to } }),
      },
      include: {
        supplier: { select: { name: true } },
        delivery: {
          include: { verifiedBy: { select: { fullName: true } } },
        },
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
    prisma.supplierDelivery.findMany({
      where: {
        supplierId: params.supplier || undefined,
        submittedAt: showingDueThroughTomorrow
          ? undefined
          : { gte: from, lte: to },
        status: {
          in: ["PENDING_EXTRACTION", "PENDING_VERIFICATION", "REJECTED"],
        },
      },
      select: { status: true, totalAmount: true },
      take: 500,
    }),
  ]);

  const rows = await Promise.all(
    bills.map(async (bill) => {
      const source = bill.invoice
        ? {
            kind: "invoice" as const,
            id: bill.invoice.id,
            occurredAt: bill.invoice.submittedAt,
            invoiceNumber: bill.invoice.invoiceNumber,
            status: bill.invoice.status,
            auditLabel: "Finalized",
            auditName: bill.invoice.finalizedBy?.fullName || null,
            receiptObjectPath: bill.invoice.receiptObjectPath,
          }
        : {
            kind: "delivery" as const,
            id: bill.delivery!.id,
            occurredAt: bill.delivery!.submittedAt,
            invoiceNumber: bill.delivery!.invoiceNumber,
            status: bill.delivery!.status,
            auditLabel: "Verified",
            auditName: bill.delivery!.verifiedBy?.fullName || null,
            receiptObjectPath: bill.delivery!.receiptObjectPath,
          };
      return {
        source: {
          ...source,
          supplierName: bill.supplier.name,
          receiptUrl: source.receiptObjectPath
            ? await createSupplierReceiptUrl(source.receiptObjectPath)
            : null,
        },
        bill,
      };
    }),
  );

  const unpaid = bills
    .filter((bill) => bill.status !== "PAID")
    .reduce(
      (sum, bill) => sum + Number(bill.totalAmount) - Number(bill.paidAmount),
      0,
    );
  const paid = bills.reduce((sum, bill) => sum + Number(bill.paidAmount), 0);
  const pending = legacyPending
    .filter((row) => row.status !== "REJECTED")
    .reduce((sum, row) => sum + Number(row.totalAmount || 0), 0);
  const rejected = legacyPending.filter(
    (row) => row.status === "REJECTED",
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
      description="Audit finalized invoices, legacy verified deliveries, balances, and every supplier payment."
    >
      <form
        className={`grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 ${showingDueThroughTomorrow ? "sm:grid-cols-2" : "sm:grid-cols-4"}`}
      >
        {showingDueThroughTomorrow ? (
          <Input type="hidden" name="scope" value="due-through-tomorrow" />
        ) : null}
        <NativeSelect
          name="supplier"
          defaultValue={params.supplier || ""}
          className="h-10 w-full rounded-lg border border-slate-200 px-2"
        >
          <option value="">All suppliers</option>
          {suppliers.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </NativeSelect>
        {showingDueThroughTomorrow ? null : (
          <>
            <Input
              type="date"
              name="from"
              defaultValue={from.toISOString().slice(0, 10)}
            />
            <Input
              type="date"
              name="to"
              defaultValue={to.toISOString().slice(0, 10)}
            />
          </>
        )}
        <Button>View report</Button>
      </form>

      {showingDueThroughTomorrow ? (
        <Card className="flex flex-col gap-3 border-amber-200 bg-amber-50 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold text-amber-900">
            Showing every unpaid or partially paid bill due through tomorrow,
            regardless of source date.
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
        <MetricCard label="Legacy pending review" value={money(pending)} />
        <MetricCard label="Legacy rejected" value={rejected} />
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
