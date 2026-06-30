import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  Card,
  AdminPage,
  MetricCard,
  Table,
  DataTableCard,
  TableCell,
  TableHead,
  ToneBadge,
} from "@/components/admin/shared";
import { prisma } from "@/lib/prisma";
import { createSupplierReceiptUrl } from "@/lib/suppliers/storage";
import PaymentForm from "./PaymentForm";

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
  searchParams?: Promise<{ from?: string; to?: string; supplier?: string }>;
}) {
  const params = (await searchParams) || {};
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const from = dateInput(params.from, defaultFrom);
  const to = dateInput(params.to, now, true);
  const [deliveries, suppliers] = await Promise.all([
    prisma.supplierDelivery.findMany({
      where: {
        supplierId: params.supplier || undefined,
        submittedAt: { gte: from, lte: to },
      },
      include: {
        supplier: true,
        verifiedBy: { select: { fullName: true } },
        bill: {
          include: {
            settledBy: { select: { fullName: true } },
            payments: {
              include: { recordedBy: { select: { fullName: true } } },
              orderBy: { paidAt: "desc" },
            },
          },
        },
      },
      orderBy: { submittedAt: "desc" },
      take: 500,
    }),
    prisma.supplier.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const rows = await Promise.all(
    deliveries.map(async (delivery) => ({
      delivery,
      receiptUrl: await createSupplierReceiptUrl(delivery.receiptObjectPath),
    })),
  );
  const bills = deliveries.flatMap((delivery) =>
    delivery.bill ? [delivery.bill] : [],
  );
  const unpaid = bills
    .filter((bill) => bill.status !== "PAID")
    .reduce(
      (sum, bill) => sum + Number(bill.totalAmount) - Number(bill.paidAmount),
      0,
    );
  const paid = bills.reduce((sum, bill) => sum + Number(bill.paidAmount), 0);
  const pending = deliveries
    .filter(
      (row) =>
        row.status === "PENDING_EXTRACTION" ||
        row.status === "PENDING_VERIFICATION",
    )
    .reduce((sum, row) => sum + Number(row.totalAmount || 0), 0);
  const rejected = deliveries.filter((row) => row.status === "REJECTED").length;
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
  for (const delivery of deliveries)
    supplierTotals.set(
      delivery.supplier.name,
      (supplierTotals.get(delivery.supplier.name) || 0) +
        Number(delivery.bill?.totalAmount || 0),
    );

  return (
    <AdminPage
      title="Supplier bills"
      description="Audit verified deliveries, balances, and every supplier payment."
    >
      <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-4">
        <NativeSelect
          name="supplier"
          defaultValue={params.supplier || ""}
          className="h-10 rounded-lg border border-slate-200 px-2"
        >
          <option value="">All suppliers</option>
          {suppliers.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </NativeSelect>
        <Input
          type="date"
          name="from"
          defaultValue={from.toISOString().slice(0, 10)}
          className="h-10 rounded-lg border border-slate-200 px-2"
        />
        <Input
          type="date"
          name="to"
          defaultValue={to.toISOString().slice(0, 10)}
          className="h-10 rounded-lg border border-slate-200 px-2"
        />
        <Button className="rounded-lg bg-blue-600 px-4 text-sm font-bold text-white">
          View report
        </Button>
      </form>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Unpaid balance" value={money(unpaid)} />
        <MetricCard label="Payments received" value={money(paid)} />
        <MetricCard label="Pending verification" value={money(pending)} />
        <MetricCard label="Rejected deliveries" value={rejected} />
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Todayâ€™s bills"
          value={money(totalSince(dayStart))}
        />
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
      <DataTableCard>
        <Table>
          <thead>
            <tr>
              <TableHead>Supplier / delivery</TableHead>
              <TableHead>Total / balance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Audit</TableHead>
              <TableHead>Payments</TableHead>
              <TableHead>Record payment</TableHead>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map(({ delivery, receiptUrl }) => {
                const bill = delivery.bill;
                const remaining = bill
                  ? Number(bill.totalAmount) - Number(bill.paidAmount)
                  : 0;
                return (
                  <tr
                    key={delivery.id}
                    className="border-t border-slate-100 align-top"
                  >
                    <TableCell>
                      <Link
                        href={`/admin/supplier-deliveries/${delivery.id}`}
                        className="font-bold text-blue-600"
                      >
                        {delivery.supplier.name}
                      </Link>
                      <div className="text-xs">
                        {delivery.submittedAt.toLocaleDateString()} Â·{" "}
                        {delivery.invoiceNumber || "No invoice #"}
                      </div>
                      <a
                        href={receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-bold text-slate-500 underline"
                      >
                        Receipt image
                      </a>
                    </TableCell>
                    <TableCell>
                      {money(Number(delivery.totalAmount || 0))}
                      <div className="text-xs">Balance {money(remaining)}</div>
                    </TableCell>
                    <TableCell>
                      <ToneBadge
                        tone={
                          delivery.status === "VERIFIED"
                            ? "green"
                            : delivery.status === "REJECTED"
                              ? "red"
                              : "amber"
                        }
                      >
                        {delivery.status.replaceAll("_", " ")}
                      </ToneBadge>
                      <div className="mt-1">
                        {bill ? (
                          <ToneBadge
                            tone={bill.status === "PAID" ? "green" : "amber"}
                          >
                            {bill.status}
                          </ToneBadge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        Verified: {delivery.verifiedBy?.fullName || "--"}
                      </div>
                      <div>Paid: {bill?.settledBy?.fullName || "--"}</div>
                      <div className="text-xs">
                        {bill?.settledAt?.toLocaleString() || ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      {bill?.payments.length
                        ? bill.payments.map((payment) => (
                            <div key={payment.id} className="mb-2 text-xs">
                              <strong>{money(Number(payment.amount))}</strong>{" "}
                              Â· {payment.paymentMethod || "Unspecified"}
                              <br />
                              {payment.recordedBy.fullName} Â·{" "}
                              {payment.paidAt.toLocaleDateString()}
                            </div>
                          ))
                        : "--"}
                    </TableCell>
                    <TableCell>
                      {bill && remaining > 0 ? (
                        <PaymentForm billId={bill.id} remaining={remaining} />
                      ) : bill ? (
                        "Paid in full"
                      ) : (
                        "Verify first"
                      )}
                    </TableCell>
                  </tr>
                );
              })
            ) : (
              <tr>
                <TableCell colSpan={6}>
                  No supplier activity in this date range.
                </TableCell>
              </tr>
            )}
          </tbody>
        </Table>
      </DataTableCard>
    </AdminPage>
  );
}
